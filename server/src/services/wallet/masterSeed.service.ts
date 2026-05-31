/**
 * Master seed service.
 *
 * One BIP-39 mnemonic rules ALL user wallets. It is generated once at
 * bootstrap (or via a dedicated admin call) and stored encrypted in the
 * DB. The raw seed is NEVER logged, returned via API, or written to .env.
 *
 * MVP encryption: AES-256-GCM with MASTER_SEED_ENC_KEY (32-byte key,
 * hex or base64). Production: swap `encrypt` / `decrypt` for AWS KMS
 * calls using MASTER_SEED_KMS_KEY_ID. The DB row already has an
 * `algorithm` and `kmsKeyId` column for that migration.
 *
 * SECURITY:
 *  - getMasterMnemonic() must only be called from walletDerivation.service
 *    and selfCustody.service on the server.
 *  - Never expose the return value over any HTTP / socket / log surface.
 */
import crypto from 'crypto';
import * as bip39 from 'bip39';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';

const ALGO = 'aes-256-gcm';
const SEED_VERSION = 1;

// ── Encryption modes ─────────────────────────────────────────────────
// 1) KMS ENVELOPE (production): a per-seed Data Encryption Key (DEK) encrypts
//    the seed with AES-256-GCM; the DEK itself is encrypted by AWS KMS and
//    never exists on disk in the clear. Compromising the DB or the server env
//    is NOT enough to decrypt the seed — you also need KMS Decrypt permission.
//    Enabled by setting MASTER_SEED_KMS_KEY_ID.
// 2) LOCAL KEY (dev / no-KMS): AES-256-GCM with MASTER_SEED_ENC_KEY from env.
//    Convenient but the key sits in the environment — use only off-production.
//
// The stored blob is self-describing JSON so we can migrate modes without a
// schema change: { mode, iv, tag, ct, edk? }.

const KMS_KEY_ID = process.env.MASTER_SEED_KMS_KEY_ID;
const KMS_REGION = process.env.AWS_REGION || process.env.MASTER_SEED_KMS_REGION || 'us-east-1';

function loadLocalKey(): Buffer {
  const raw = process.env.MASTER_SEED_ENC_KEY;
  if (!raw) {
    throw new Error(
      'No custody key configured. Set MASTER_SEED_KMS_KEY_ID (production, recommended) ' +
        'or MASTER_SEED_ENC_KEY (32-byte hex/base64, dev only).'
    );
  }
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('MASTER_SEED_ENC_KEY must decode to exactly 32 bytes.');
  return key;
}

// Lazily-loaded KMS client so the AWS SDK is only required when KMS is enabled.
let _kms: any = null;
async function kmsClient(): Promise<any> {
  if (_kms) return _kms;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { KMSClient } = require('@aws-sdk/client-kms');
  _kms = new KMSClient({ region: KMS_REGION });
  return _kms;
}

async function aesEncrypt(dek: Buffer, plaintext: string): Promise<{ iv: string; tag: string; ct: string }> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, dek, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ct: ct.toString('base64') };
}
function aesDecrypt(dek: Buffer, iv: string, tag: string, ct: string): string {
  const decipher = crypto.createDecipheriv(ALGO, dek, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}

async function encrypt(plaintext: string): Promise<string> {
  if (KMS_KEY_ID) {
    // Envelope: ask KMS for a fresh 256-bit DEK (plaintext + KMS-wrapped form).
    const { GenerateDataKeyCommand } = require('@aws-sdk/client-kms');
    const kms = await kmsClient();
    const out = await kms.send(new GenerateDataKeyCommand({ KeyId: KMS_KEY_ID, KeySpec: 'AES_256' }));
    const dek = Buffer.from(out.Plaintext);
    const edk = Buffer.from(out.CiphertextBlob).toString('base64'); // KMS-encrypted DEK
    const { iv, tag, ct } = await aesEncrypt(dek, plaintext);
    dek.fill(0); // wipe plaintext DEK from memory ASAP
    return JSON.stringify({ mode: 'kms', edk, iv, tag, ct });
  }
  const dek = loadLocalKey();
  const { iv, tag, ct } = await aesEncrypt(dek, plaintext);
  return JSON.stringify({ mode: 'local', iv, tag, ct });
}

async function decrypt(blob: string): Promise<string> {
  // Back-compat: older rows stored a bare base64 IV||TAG||CT under the local key.
  if (!blob.startsWith('{')) {
    const dek = loadLocalKey();
    const buf = Buffer.from(blob, 'base64');
    return aesDecrypt(dek, buf.subarray(0, 12).toString('base64'), buf.subarray(12, 28).toString('base64'), buf.subarray(28).toString('base64'));
  }
  const parsed = JSON.parse(blob);
  if (parsed.mode === 'kms') {
    const { DecryptCommand } = require('@aws-sdk/client-kms');
    const kms = await kmsClient();
    const out = await kms.send(new DecryptCommand({ CiphertextBlob: Buffer.from(parsed.edk, 'base64'), KeyId: KMS_KEY_ID }));
    const dek = Buffer.from(out.Plaintext);
    const pt = aesDecrypt(dek, parsed.iv, parsed.tag, parsed.ct);
    dek.fill(0);
    return pt;
  }
  // local mode
  return aesDecrypt(loadLocalKey(), parsed.iv, parsed.tag, parsed.ct);
}

/**
 * Ensure a master seed exists. Called at server bootstrap. Idempotent.
 * If a seed row already exists it is left untouched.
 */
export async function ensureMasterSeed(): Promise<void> {
  const existing = await prisma.masterSeedStore.findUnique({ where: { version: SEED_VERSION } });
  if (existing) return;

  const mnemonic = bip39.generateMnemonic(256); // 24 words
  const ciphertext = await encrypt(mnemonic);
  await prisma.masterSeedStore.create({
    data: {
      version: SEED_VERSION,
      ciphertext,
      algorithm: KMS_KEY_ID ? 'KMS-ENVELOPE-AES-256-GCM' : 'AES-256-GCM',
      kmsKeyId: KMS_KEY_ID ?? null,
    },
  });
  // Deliberately not logging the mnemonic. Only a short fingerprint.
  const fp = crypto.createHash('sha256').update(mnemonic).digest('hex').slice(0, 8);
  logger.info(`[masterSeed] Generated new master seed (fp=${fp}, v${SEED_VERSION})`);
}

/**
 * Decrypts and returns the master BIP-39 mnemonic. Internal use only.
 * Do not expose the return value outside the server process.
 */
export async function getMasterMnemonic(): Promise<string> {
  const row = await prisma.masterSeedStore.findUnique({ where: { version: SEED_VERSION } });
  if (!row) {
    throw new Error('Master seed has not been initialised. Call ensureMasterSeed() first.');
  }
  return decrypt(row.ciphertext);  // async
}

/**
 * Returns the raw 64-byte BIP-39 seed (mnemonic + optional passphrase).
 * This is the value passed to HD derivation libraries.
 */
export async function getMasterSeedBuffer(): Promise<Buffer> {
  const mnemonic = await getMasterMnemonic();
  const passphrase = process.env.MASTER_SEED_PASSPHRASE || '';
  return bip39.mnemonicToSeedSync(mnemonic, passphrase);
}
