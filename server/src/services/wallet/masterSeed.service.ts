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

const ALGO = 'aes-256-gcm';
const SEED_VERSION = 1;

function loadKey(): Buffer {
  const raw = process.env.MASTER_SEED_ENC_KEY;
  if (!raw) {
    throw new Error(
      'MASTER_SEED_ENC_KEY is not set. Generate a 32-byte key ' +
        '(`openssl rand -hex 32`) and put it in .env before starting the server.'
    );
  }
  // Accept hex (64 chars) or base64.
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    key = Buffer.from(raw, 'base64');
  }
  if (key.length !== 32) {
    throw new Error('MASTER_SEED_ENC_KEY must decode to exactly 32 bytes.');
  }
  return key;
}

function encrypt(plaintext: string): string {
  const key = loadKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: IV(12) || TAG(16) || CT
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function decrypt(blob: string): string {
  const key = loadKey();
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

/**
 * Ensure a master seed exists. Called at server bootstrap. Idempotent.
 * If a seed row already exists it is left untouched.
 */
export async function ensureMasterSeed(): Promise<void> {
  const existing = await prisma.masterSeedStore.findUnique({ where: { version: SEED_VERSION } });
  if (existing) return;

  const mnemonic = bip39.generateMnemonic(256); // 24 words
  const ciphertext = encrypt(mnemonic);
  await prisma.masterSeedStore.create({
    data: {
      version: SEED_VERSION,
      ciphertext,
      algorithm: 'AES-256-GCM',
    },
  });
  // Deliberately not logging the mnemonic. Only a short fingerprint.
  const fp = crypto.createHash('sha256').update(mnemonic).digest('hex').slice(0, 8);
  console.log(`[masterSeed] Generated new master seed (fp=${fp}, v${SEED_VERSION})`);
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
  return decrypt(row.ciphertext);
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
