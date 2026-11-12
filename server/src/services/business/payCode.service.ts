/**
 * A business's one payment QR.
 *
 * The code is a permanent link to the business account's user id, never its
 * @handle: a printed sticker must keep paying the same business after it
 * renames, and a released handle must never send a shop's customers to
 * whoever registers it next. Scanning resolves through /api/pay/payee, which
 * shows the KYB-verified trading name before the customer confirms.
 *
 * Wallet cards (Apple Wallet, Google Wallet) carry the same link. They are
 * issued only to KYB-approved businesses: the pass is signed with tazdan's
 * certificate, so it vouches for the name printed on it.
 *
 * Apple: a .pkpass is a zip of pass.json, images, manifest.json (SHA-1 of
 * every file) and a detached PKCS#7 signature of the manifest made with the
 * Pass Type ID certificate plus Apple's WWDR intermediate. Signing uses the
 * openssl CLI (installed in the server image) — no crypto dependency added.
 * Google: a "Save to Google Wallet" link is a JWT signed by the issuer's
 * service account, carrying the generic class and object inline.
 */
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import jwt from 'jsonwebtoken';
import type { BusinessProfile } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const ASSETS = path.join(__dirname, '../../assets/wallet');
const PASS_IMAGES = ['icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png'];

const env = (k: string) => process.env[k]?.trim() || '';
const linkBase = () => (env('PAY_LINK_BASE') || 'https://tazdan.com').replace(/\/+$/, '');

export const payLinkFor = (business: Pick<BusinessProfile, 'userId'>) => `${linkBase()}/pay/${business.userId}`;

const APPLE_ENV = ['APPLE_PASS_TYPE_ID', 'APPLE_TEAM_ID', 'APPLE_PASS_CERT_PATH', 'APPLE_PASS_KEY_PATH', 'APPLE_WWDR_CERT_PATH'];
const GOOGLE_ENV = ['GOOGLE_WALLET_ISSUER_ID', 'GOOGLE_WALLET_SA_EMAIL', 'GOOGLE_WALLET_SA_KEY_PATH'];
export const appleWalletConfigured = () => APPLE_ENV.every((k) => !!env(k));
export const googleWalletConfigured = () => GOOGLE_ENV.every((k) => !!env(k));

export async function payCodeFor(business: BusinessProfile) {
  const owner = await prisma.user.findUnique({ where: { id: business.userId }, select: { username: true } });
  const verified = business.kybStatus === 'APPROVED';
  return {
    payUrl: payLinkFor(business),
    payeeId: business.userId,
    name: business.tradingName?.trim() || business.companyName,
    handle: owner?.username ?? null,
    verified,
    wallet: { apple: verified && appleWalletConfigured(), google: verified && googleWalletConfigured() },
    /** For the printed QR and plaque; null = tazdan navy. */
    brand: { primary: business.brandPrimary, secondary: business.brandSecondary, logoUrl: business.logoUrl },
  };
}

function assertWalletIssuable(business: BusinessProfile, configured: boolean, which: string) {
  if (!configured) throw new AppError(`${which} cards are not set up yet`, 503);
  if (business.kybStatus !== 'APPROVED') throw new AppError('Wallet cards are issued once the business is verified', 403, 'COMPLIANCE_HOLD');
}

// ── Download link for the Apple pass ────────────────────────────────
// iOS adds a pass when Safari opens a .pkpass URL, and Safari can't send the
// app's bearer token — so the app gets a short-lived link instead. Its key is
// derived from JWT_SECRET but differs from it, so the link can never pass as
// an access token (and vice versa).
function tokenKey() {
  const secret = env('JWT_SECRET');
  if (!secret) throw new AppError('Server misconfigured', 500);
  return createHash('sha256').update(`wallet-pass:${secret}`).digest();
}

export function walletPassToken(businessId: string, ttlSeconds = 600): string {
  const body = `${businessId}.${Math.floor(Date.now() / 1000) + ttlSeconds}`;
  const sig = createHmac('sha256', tokenKey()).update(body).digest('base64url');
  return `${Buffer.from(body).toString('base64url')}.${sig}`;
}

/** The business id, or null for a forged, altered or expired link. */
export function readWalletPassToken(token: string): string | null {
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const body = Buffer.from(encoded, 'base64url').toString();
  const want = createHmac('sha256', tokenKey()).update(body).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const [businessId, exp] = body.split('.');
  return businessId && Number(exp) > Date.now() / 1000 ? businessId : null;
}

// ── Apple Wallet ────────────────────────────────────────────────────
export async function buildApplePass(business: BusinessProfile): Promise<Buffer> {
  assertWalletIssuable(business, appleWalletConfigured(), 'Apple Wallet');
  const code = await payCodeFor(business);
  const pass = {
    formatVersion: 1,
    passTypeIdentifier: env('APPLE_PASS_TYPE_ID'),
    teamIdentifier: env('APPLE_TEAM_ID'),
    serialNumber: `biz-${business.id}`,
    organizationName: 'tazdan',
    description: `Pay ${code.name} with tazdan`,
    foregroundColor: 'rgb(255,255,255)',
    labelColor: 'rgb(159,178,198)',
    backgroundColor: 'rgb(36,56,79)',
    sharingProhibited: false,
    generic: {
      primaryFields: [{ key: 'name', label: 'PAY', value: code.name }],
      secondaryFields: code.handle ? [{ key: 'handle', label: 'TAZDAN', value: `@${code.handle}` }] : [],
      backFields: [
        { key: 'how', label: 'How to pay', value: 'Open tazdan, tap Pay and scan this code. The app shows the verified business name before you confirm.' },
        { key: 'link', label: 'Payment link', value: code.payUrl },
      ],
    },
    barcodes: [{
      format: 'PKBarcodeFormatQR', message: code.payUrl, messageEncoding: 'iso-8859-1',
      ...(code.handle ? { altText: `@${code.handle}` } : {}),
    }],
  };

  const files: Array<[string, Buffer]> = [['pass.json', Buffer.from(JSON.stringify(pass))]];
  for (const name of PASS_IMAGES) files.push([name, await fs.readFile(path.join(ASSETS, name))]);
  const manifest = Buffer.from(JSON.stringify(Object.fromEntries(
    files.map(([name, data]) => [name, createHash('sha1').update(data).digest('hex')]),
  )));
  const signature = await signManifest(manifest);
  return zipStored([...files, ['manifest.json', manifest], ['signature', signature]]);
}

function signManifest(manifest: Buffer): Promise<Buffer> {
  // Signed attributes (incl. signing time, which Wallet requires) are kept:
  // no -noattr. The key passphrase is read from the environment, never argv.
  const args = ['smime', '-binary', '-sign',
    '-signer', env('APPLE_PASS_CERT_PATH'), '-inkey', env('APPLE_PASS_KEY_PATH'),
    '-certfile', env('APPLE_WWDR_CERT_PATH'), '-outform', 'DER'];
  if (env('APPLE_PASS_KEY_PASSWORD')) args.push('-passin', 'env:APPLE_PASS_KEY_PASSWORD');
  return new Promise((resolve, reject) => {
    const child = execFile('openssl', args, { encoding: 'buffer', maxBuffer: 1 << 20 }, (err, stdout, stderr) => {
      if (err || !stdout.length) {
        logger.error('[wallet] Apple pass signing failed', { error: String(err), stderr: stderr?.toString().slice(0, 500) });
        reject(new AppError('Could not create the Wallet card', 500));
      } else resolve(stdout);
    });
    child.stdin?.end(manifest);
  });
}

// ── Google Wallet ───────────────────────────────────────────────────
export async function googleWalletSaveUrl(business: BusinessProfile): Promise<string> {
  assertWalletIssuable(business, googleWalletConfigured(), 'Google Wallet');
  const code = await payCodeFor(business);
  const issuer = env('GOOGLE_WALLET_ISSUER_ID');
  const classId = `${issuer}.tazdan_business_pay`;
  // Accept the service-account JSON file or just its PEM private key.
  const raw = await fs.readFile(env('GOOGLE_WALLET_SA_KEY_PATH'), 'utf8');
  const privateKey = raw.trim().startsWith('{') ? JSON.parse(raw).private_key : raw;
  const text = (value: string) => ({ defaultValue: { language: 'en', value } });
  const logo = env('GOOGLE_WALLET_LOGO_URL');
  const token = jwt.sign({
    iss: env('GOOGLE_WALLET_SA_EMAIL'),
    aud: 'google',
    typ: 'savetowallet',
    origins: [],
    payload: {
      genericClasses: [{ id: classId }],
      genericObjects: [{
        id: `${issuer}.biz_${business.id.replace(/[^\w.-]/g, '_')}`,
        classId,
        state: 'ACTIVE',
        hexBackgroundColor: '#24384F',
        cardTitle: text('tazdan'),
        header: text(code.name),
        subheader: text('Scan to pay'),
        barcode: { type: 'QR_CODE', value: code.payUrl, ...(code.handle ? { alternateText: `@${code.handle}` } : {}) },
        ...(logo ? { logo: { sourceUri: { uri: logo }, contentDescription: text('tazdan') } } : {}),
      }],
    },
  }, privateKey, { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}

// ── Minimal zip (stored, no compression) ────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipStored(files: Array<[string, Buffer]>): Buffer {
  const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01: entries carry no real timestamp
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of files) {
    const fileName = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(DOS_DATE, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(fileName.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, fileName, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(0, 10); entry.writeUInt16LE(0, 12); entry.writeUInt16LE(DOS_DATE, 14); entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(fileName.length, 28);
    entry.writeUInt16LE(0, 30); entry.writeUInt16LE(0, 32); entry.writeUInt16LE(0, 34); entry.writeUInt16LE(0, 36);
    entry.writeUInt32LE(0, 38); entry.writeUInt32LE(offset, 42);
    central.push(entry, fileName);
    offset += local.length + fileName.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, cd, end]);
}
