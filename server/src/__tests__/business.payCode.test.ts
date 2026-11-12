/**
 * A business's payment QR and its Wallet cards (services/business/payCode).
 *
 *   - the code links to the account id, never the @handle
 *   - the Apple pass is a valid zip whose manifest hashes every file and
 *     whose PKCS#7 signature verifies against the (test) WWDR chain
 *   - cards only for KYB-approved businesses, and only once configured
 *   - the Safari download link is signed, short-lived and tamper-proof
 *   - the Google Wallet link is a JWT signed by the service account
 *
 * Uses throwaway certificates made with the openssl CLI (as in production).
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import type { BusinessProfile } from '@prisma/client';

jest.mock('../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn().mockResolvedValue({ username: 'olivelane' }) },
    businessProfile: { findUnique: jest.fn() },
  },
}));

import { prisma } from '../utils/prisma';
import {
  buildApplePass, googleWalletSaveUrl, payCodeFor, payLinkFor, readWalletPassToken, walletPassToken, zipStored,
} from '../services/business/payCode.service';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-wallet-'));
const file = (n: string) => path.join(dir, n);
const ssl = (...args: string[]) => execFileSync('openssl', args, { stdio: 'pipe' });

const business = (extra: Partial<BusinessProfile> = {}) => ({
  id: '6c0f3b8e-7a51-4c1e-9d2f-1b2a3c4d5e6f', userId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  companyName: 'Olive Lane Trading LLC', tradingName: 'Olive Lane Café', kybStatus: 'APPROVED', ...extra,
}) as unknown as BusinessProfile;

/** Entries of a zip, read by Python's zipfile (CRC-checked), not our writer. */
function unzip(buf: Buffer): Record<string, Buffer> {
  const zip = file(`z${Math.random().toString(36).slice(2)}.zip`);
  fs.writeFileSync(zip, buf);
  const out = execFileSync('python3', ['-c', [
    'import zipfile,sys,json,base64',
    'z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None',
    'print(json.dumps({n: base64.b64encode(z.read(n)).decode() for n in z.namelist()}))',
  ].join('\n'), zip]).toString();
  return Object.fromEntries(Object.entries(JSON.parse(out) as Record<string, string>).map(([k, v]) => [k, Buffer.from(v, 'base64')]));
}

beforeAll(() => {
  // A stand-in "WWDR" CA and a pass certificate it issued.
  ssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', file('ca.key'), '-out', file('ca.pem'), '-days', '2', '-subj', '/CN=Test WWDR');
  ssl('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', file('pass.key'), '-out', file('pass.csr'), '-subj', '/CN=pass.com.tazdan.test');
  ssl('x509', '-req', '-in', file('pass.csr'), '-CA', file('ca.pem'), '-CAkey', file('ca.key'), '-CAcreateserial', '-out', file('pass.pem'), '-days', '2');
  ssl('genrsa', '-out', file('google.key'), '2048');
  Object.assign(process.env, {
    JWT_SECRET: 'test_jwt_secret_min_32_chars_long_for_wallet_tests',
    APPLE_PASS_TYPE_ID: 'pass.com.tazdan.test', APPLE_TEAM_ID: 'TEAMID1234',
    APPLE_PASS_CERT_PATH: file('pass.pem'), APPLE_PASS_KEY_PATH: file('pass.key'), APPLE_WWDR_CERT_PATH: file('ca.pem'),
    GOOGLE_WALLET_ISSUER_ID: '3388000000012345678', GOOGLE_WALLET_SA_EMAIL: 'wallet@tazdan-test.iam.gserviceaccount.com',
    GOOGLE_WALLET_SA_KEY_PATH: file('google.key'),
  });
  delete process.env.PAY_LINK_BASE;
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('business payment QR', () => {
  it('links to the account id, never the handle', async () => {
    expect(payLinkFor(business())).toBe('https://tazdan.com/pay/0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d');
    const code = await payCodeFor(business());
    expect(code).toMatchObject({ name: 'Olive Lane Café', handle: 'olivelane', verified: true, wallet: { apple: true, google: true } });
    expect(code.payUrl).not.toContain('olivelane');
  });

  it('offers no wallet card before KYB approval', async () => {
    const code = await payCodeFor(business({ kybStatus: 'PENDING' } as Partial<BusinessProfile>));
    expect(code.wallet).toEqual({ apple: false, google: false });
    await expect(buildApplePass(business({ kybStatus: 'PENDING' } as Partial<BusinessProfile>))).rejects.toMatchObject({ statusCode: 403 });
    await expect(googleWalletSaveUrl(business({ kybStatus: 'REJECTED' } as Partial<BusinessProfile>))).rejects.toMatchObject({ statusCode: 403 });
  });

  it('builds a signed Apple Wallet pass that carries the QR link', async () => {
    const files = unzip(await buildApplePass(business()));
    expect(Object.keys(files).sort()).toEqual(
      ['icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png', 'manifest.json', 'pass.json', 'signature'],
    );
    const pass = JSON.parse(files['pass.json'].toString());
    expect(pass).toMatchObject({ formatVersion: 1, passTypeIdentifier: 'pass.com.tazdan.test', teamIdentifier: 'TEAMID1234' });
    expect(pass.barcodes[0]).toMatchObject({ format: 'PKBarcodeFormatQR', message: payLinkFor(business()), altText: '@olivelane' });
    expect(pass.generic.primaryFields[0].value).toBe('Olive Lane Café');

    const manifest = JSON.parse(files['manifest.json'].toString());
    for (const [name, data] of Object.entries(files)) {
      if (name === 'manifest.json' || name === 'signature') continue;
      expect(manifest[name]).toBe(createHash('sha1').update(data).digest('hex'));
    }
    fs.writeFileSync(file('manifest.json'), files['manifest.json']);
    fs.writeFileSync(file('signature'), files.signature);
    // Throws unless the detached signature matches the manifest and chains to the CA.
    ssl('smime', '-verify', '-binary', '-inform', 'DER', '-in', file('signature'), '-content', file('manifest.json'),
      '-CAfile', file('ca.pem'), '-purpose', 'any', '-out', file('verified.json'));
    // Wallet rejects passes without a signing time.
    expect(ssl('cms', '-cmsout', '-print', '-inform', 'DER', '-in', file('signature')).toString()).toContain('signingTime');
  });

  it('refuses a card when Apple Wallet is not set up', async () => {
    const saved = process.env.APPLE_PASS_CERT_PATH;
    delete process.env.APPLE_PASS_CERT_PATH;
    try {
      await expect(buildApplePass(business())).rejects.toMatchObject({ statusCode: 503 });
      expect((await payCodeFor(business())).wallet.apple).toBe(false);
    } finally {
      process.env.APPLE_PASS_CERT_PATH = saved;
    }
  });

  it('signs Google Wallet save links with the service account', async () => {
    const url = await googleWalletSaveUrl(business());
    expect(url.startsWith('https://pay.google.com/gp/v/save/')).toBe(true);
    const publicKey = execFileSync('openssl', ['rsa', '-in', file('google.key'), '-pubout'], { stdio: 'pipe' }).toString();
    const claims = jwt.verify(url.split('/').pop()!, publicKey, { algorithms: ['RS256'] }) as any;
    expect(claims).toMatchObject({ iss: 'wallet@tazdan-test.iam.gserviceaccount.com', aud: 'google', typ: 'savetowallet' });
    const object = claims.payload.genericObjects[0];
    expect(object.classId).toBe('3388000000012345678.tazdan_business_pay');
    expect(object.barcode).toMatchObject({ type: 'QR_CODE', value: payLinkFor(business()) });
    expect(object.header.defaultValue.value).toBe('Olive Lane Café');
  });
});

describe('wallet card download link', () => {
  it('round-trips and rejects tampering or expiry', () => {
    const token = walletPassToken('biz-123');
    expect(readWalletPassToken(token)).toBe('biz-123');
    const [body, sig] = token.split('.');
    const forged = Buffer.from(Buffer.from(body, 'base64url').toString().replace('biz-123', 'biz-999')).toString('base64url');
    expect(readWalletPassToken(`${forged}.${sig}`)).toBeNull();
    expect(readWalletPassToken(walletPassToken('biz-123', -1))).toBeNull();
    expect(readWalletPassToken('garbage')).toBeNull();
  });

  it('is not interchangeable with an access token', () => {
    const access = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET!);
    expect(readWalletPassToken(access)).toBeNull();
    expect(() => jwt.verify(walletPassToken('biz-123'), process.env.JWT_SECRET!)).toThrow();
  });

  it('serves the pass to Safari without a bearer token, and 410s an expired link', async () => {
    const { payRouter } = await import('../routes/pay');
    const { errorHandler } = await import('../middleware/errorHandler');
    const app = express().use('/api/pay', payRouter).use(errorHandler);
    (prisma.businessProfile.findUnique as jest.Mock).mockResolvedValue(business());

    const ok = await request(app).get(`/api/pay/wallet/apple/${walletPassToken(business().id)}`).buffer(true)
      .parse((res, cb) => { const chunks: Buffer[] = []; res.on('data', (c: Buffer) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toContain('application/vnd.apple.pkpass');
    expect(Object.keys(unzip(ok.body))).toContain('signature');

    const expired = await request(app).get(`/api/pay/wallet/apple/${walletPassToken(business().id, -5)}`);
    expect(expired.status).toBe(410);
  });
});

describe('zip writer', () => {
  it('writes archives standard tools read back byte for byte', () => {
    const files: Array<[string, Buffer]> = [['a.txt', Buffer.from('hello')], ['empty', Buffer.alloc(0)], ['bin', Buffer.from([0, 255, 10, 13])]];
    const back = unzip(zipStored(files));
    for (const [name, data] of files) expect(back[name].equals(data)).toBe(true);
  });
});
