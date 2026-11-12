/**
 * The business logo as a data URI, for print HTML and QR image export:
 * printing and snapshots don't wait for a remote image, so it is fetched
 * once into the cache (uploads have unique names, so a new logo is a new file).
 */
import { File, Paths } from 'expo-file-system';

export async function logoDataUri(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const name = `biz-logo-${url.split('/').pop()?.replace(/[^\w.-]/g, '') || 'logo.png'}`;
    const file = new File(Paths.cache, name);
    if (!file.exists) await File.downloadFileAsync(url, file, { idempotent: true });
    const mime = /\.jpe?g$/i.test(name) ? 'image/jpeg' : 'image/png';
    return `data:${mime};base64,${await file.base64()}`;
  } catch {
    return null;
  }
}
