import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Storage:
 *  - Filenames are server-generated UUIDs. The original filename is
 *    discarded entirely (never honoured in path) to prevent traversal
 *    and naming-collision races.
 *  - Extensions are constrained to a small allowlist and lowercased.
 */

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (_req, file, cb) => {
    // Trust the parsed mimetype for the extension — but the actual
    // bytes will be verified after upload completes (see verifyMagic).
    const ext = MIME_TO_EXT[file.mimetype] || '.bin';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, WEBP, and PDF files are allowed'));
  }
  // Reject suspicious original filenames as a belt-and-braces check.
  // The disk name is a UUID anyway, but this stops a client from
  // shipping shell-control characters in metadata we might later log.
  // eslint-disable-next-line no-control-regex
  if (/[ -]|\/|\\|\.\./.test(file.originalname || '')) {
    return cb(new Error('Invalid filename'));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'),
    files: 1,
    fields: 20,
    fieldNameSize: 100,
    fieldSize: 1024 * 100,
  },
});

/**
 * Verify the first few bytes of an uploaded file match its declared
 * MIME type. Defeats the trivial "rename foo.html to foo.png" attack
 * — client-supplied MIME is otherwise just a hint.
 *
 * Call after multer has written the file to disk:
 *
 *   router.post('/kyc', upload.single('doc'), async (req, res, next) => {
 *     try { await verifyMagic(req.file!); ...
 */
import fs from 'fs/promises';

const MAGIC_BYTES: Array<{ mime: string; sig: number[]; offset?: number }> = [
  { mime: 'image/jpeg', sig: [0xff, 0xd8, 0xff] },
  { mime: 'image/png',  sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/webp', sig: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" + WEBP at offset 8 (checked below)
  { mime: 'application/pdf', sig: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
];

export async function verifyMagic(file: Express.Multer.File): Promise<void> {
  const head = await readFirstBytes(file.path, 16);
  const match = MAGIC_BYTES.find((m) => m.mime === file.mimetype);
  if (!match) throw new Error('Disallowed file type');
  for (let i = 0; i < match.sig.length; i++) {
    if (head[i + (match.offset ?? 0)] !== match.sig[i]) {
      // Bytes do not match the declared MIME — delete + reject.
      await fs.unlink(file.path).catch(() => {});
      throw new Error('File contents do not match declared type');
    }
  }
  // Extra WEBP check — "WEBP" should appear at offset 8.
  if (file.mimetype === 'image/webp') {
    const tag = head.slice(8, 12).toString('utf8');
    if (tag !== 'WEBP') {
      await fs.unlink(file.path).catch(() => {});
      throw new Error('Invalid WEBP file');
    }
  }
}

async function readFirstBytes(filePath: string, n: number): Promise<Buffer> {
  const fh = await fs.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(n);
    await fh.read(buf, 0, n, 0);
    return buf;
  } finally {
    await fh.close();
  }
}
