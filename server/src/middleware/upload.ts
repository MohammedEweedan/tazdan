import multer from 'multer';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errorHandler';

/**
 * Customer uploads (KYC documents, deposit proofs).
 *
 *  - Filenames are server-generated UUIDs; the original name is never used
 *    in a path. Extensions come from a small allowlist.
 *  - The bytes must match the declared type (`verifyUploads`); a renamed
 *    HTML/SVG/script file is rejected and deleted.
 *  - Location and device metadata (EXIF/XMP/text chunks) are removed from
 *    JPEG, PNG and WebP images; a JPEG keeps only its orientation.
 *  - A request that ends in an error deletes what it uploaded
 *    (`discardUploadsOnFailure`), so rejected requests cannot fill the disk.
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
    return cb(new AppError('Only JPEG, PNG, WEBP, and PDF files are allowed', 400));
  }
  // Reject suspicious original filenames as a belt-and-braces check.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]|\/|\\|\.\./.test(file.originalname || '')) {
    return cb(new AppError('Invalid filename', 400));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'),
    // Each route caps its own count (single() = 1, array('documents', 3) = 3).
    files: 3,
    fields: 20,
    fieldNameSize: 100,
    fieldSize: 1024 * 100,
  },
});

const MAGIC_BYTES: Array<{ mime: string; sig: number[]; offset?: number }> = [
  { mime: 'image/jpeg', sig: [0xff, 0xd8, 0xff] },
  { mime: 'image/png',  sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/webp', sig: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" + "WEBP" at offset 8 (checked below)
  { mime: 'application/pdf', sig: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
  { mime: 'image/gif',  sig: [0x47, 0x49, 0x46, 0x38] }, // "GIF8"
  { mime: 'video/mp4',  sig: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // "ftyp"
  { mime: 'video/webm', sig: [0x1a, 0x45, 0xdf, 0xa3] }, // EBML
];

/** True when `head` starts with the signature of `mime`. */
export function matchesMagic(mime: string, head: Buffer): boolean {
  const match = MAGIC_BYTES.find((m) => m.mime === mime);
  if (!match) return false;
  for (let i = 0; i < match.sig.length; i++) {
    if (head[i + (match.offset ?? 0)] !== match.sig[i]) return false;
  }
  if (mime === 'image/webp' && head.subarray(8, 12).toString('latin1') !== 'WEBP') return false;
  return true;
}

/**
 * Verify the first bytes of an uploaded file match its declared MIME type.
 * Deletes the file and throws when they do not.
 */
export async function verifyMagic(file: Express.Multer.File): Promise<void> {
  const head = await readFirstBytes(file.path, 16);
  if (!matchesMagic(file.mimetype, head)) {
    await fs.unlink(file.path).catch(() => {});
    throw new Error('File contents do not match declared type');
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

// ── Metadata stripping ────────────────────────────────────────────────

/** Minimal EXIF APP1 segment holding only an orientation tag (big-endian TIFF). */
function orientationApp1(orientation: number): Buffer {
  const tiff = Buffer.alloc(8 + 2 + 12 + 4);
  tiff.write('MM', 0, 'latin1');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);          // IFD0 offset
  tiff.writeUInt16BE(1, 8);          // one entry
  tiff.writeUInt16BE(0x0112, 10);    // Orientation
  tiff.writeUInt16BE(3, 12);         // SHORT
  tiff.writeUInt32BE(1, 14);         // count
  tiff.writeUInt16BE(orientation, 18);
  tiff.writeUInt32BE(0, 22);         // no next IFD
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const head = Buffer.alloc(4);
  head.writeUInt16BE(0xffe1, 0);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
}

/** Orientation (1–8) from an EXIF APP1 payload, if present. */
function exifOrientation(app1: Buffer): number | null {
  if (app1.length < 14 || app1.subarray(0, 6).toString('latin1') !== 'Exif\0\0') return null;
  const t = app1.subarray(6);
  const le = t.subarray(0, 2).toString('latin1') === 'II';
  const u16 = (o: number) => (le ? t.readUInt16LE(o) : t.readUInt16BE(o));
  const u32 = (o: number) => (le ? t.readUInt32LE(o) : t.readUInt32BE(o));
  try {
    const ifd = u32(4);
    const n = u16(ifd);
    for (let i = 0; i < n && i < 512; i++) {
      const e = ifd + 2 + i * 12;
      if (u16(e) === 0x0112) {
        const v = u16(e + 8);
        return v >= 1 && v <= 8 ? v : null;
      }
    }
  } catch { /* malformed EXIF: treat as none */ }
  return null;
}

/** JPEG without APP1 (EXIF/XMP), APP12, APP13 (IPTC) and comments; orientation kept. */
export function stripJpegMetadata(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const out: Buffer[] = [buf.subarray(0, 2)];
  let orientation: number | null = null;
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return buf; // not a marker where one must be: leave the file alone
    const marker = buf[i + 1];
    if (marker === 0xff) { i += 1; continue; } // fill byte before a marker
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { out.push(buf.subarray(i, i + 2)); i += 2; continue; }
    if (marker === 0xda || marker === 0xd9) {
      // Start of scan (or end): everything from here is image data.
      const rest = buf.subarray(i);
      // Keep JFIF's APP0 first when present; the orientation segment follows it.
      if (orientation) out.splice(out.length > 1 && out[1][1] === 0xe0 ? 2 : 1, 0, orientationApp1(orientation));
      return Buffer.concat([...out, rest]);
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) return buf;
    const seg = buf.subarray(i, i + 2 + len);
    if (marker === 0xe1) orientation = orientation ?? exifOrientation(seg.subarray(4));
    const drop = marker === 0xe1 || marker === 0xec || marker === 0xed || marker === 0xfe;
    if (!drop) out.push(seg);
    i += 2 + len;
  }
  return buf;
}

const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
/** PNG without EXIF and text chunks. */
export function stripPngMetadata(buf: Buffer): Buffer {
  if (buf.length < 8 || !matchesMagic('image/png', buf.subarray(0, 16))) return buf;
  const out: Buffer[] = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.subarray(i + 4, i + 8).toString('latin1');
    const end = i + 12 + len;
    if (end > buf.length) return buf;
    if (!PNG_DROP.has(type)) out.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(out);
}

/** WebP without EXIF and XMP chunks (VP8X flags updated). */
export function stripWebpMetadata(buf: Buffer): Buffer {
  if (buf.length < 12 || !matchesMagic('image/webp', buf.subarray(0, 16))) return buf;
  const chunks: Buffer[] = [];
  let i = 12;
  while (i + 8 <= buf.length) {
    const fourcc = buf.subarray(i, i + 4).toString('latin1');
    const size = buf.readUInt32LE(i + 4);
    const end = i + 8 + size + (size % 2);
    if (i + 8 + size > buf.length) return buf;
    if (fourcc !== 'EXIF' && fourcc !== 'XMP ') {
      const chunk = Buffer.from(buf.subarray(i, Math.min(end, buf.length)));
      if (fourcc === 'VP8X' && chunk.length > 8) chunk[8] &= ~0x0c; // clear EXIF (0x08) and XMP (0x04) flags
      chunks.push(chunk);
    }
    i = end;
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, body]);
}

export function stripImageMetadata(mime: string, buf: Buffer): Buffer {
  if (mime === 'image/jpeg') return stripJpegMetadata(buf);
  if (mime === 'image/png') return stripPngMetadata(buf);
  if (mime === 'image/webp') return stripWebpMetadata(buf);
  return buf;
}

function uploadedFiles(req: Request): Express.Multer.File[] {
  const files: Express.Multer.File[] = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);
  else if (req.files && typeof req.files === 'object') for (const list of Object.values(req.files)) files.push(...list);
  return files;
}

/**
 * Mount after multer: checks every uploaded file's bytes against its declared
 * type and strips image metadata in place. Any failure deletes all of the
 * request's files and answers 400.
 */
export async function verifyUploads(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const files = uploadedFiles(req);
  try {
    for (const file of files) {
      await verifyMagic(file);
      if (file.mimetype.startsWith('image/')) {
        const original = await fs.readFile(file.path);
        const clean = stripImageMetadata(file.mimetype, original);
        if (clean !== original) {
          await fs.writeFile(file.path, clean);
          file.size = clean.length;
        }
      }
    }
    next();
  } catch {
    await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})));
    next(new AppError('File contents do not match the declared type', 400));
  }
}

/**
 * Mount BEFORE multer: when the response is an error, delete whatever the
 * request uploaded (rejected KYC submissions and invalid deposit forms used
 * to leave their files on disk).
 */
export function discardUploadsOnFailure(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    if (res.statusCode < 400) return;
    for (const f of uploadedFiles(req)) void fs.unlink(f.path).catch(() => {});
  });
  next();
}
