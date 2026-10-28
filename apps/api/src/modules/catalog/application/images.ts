import { AppError } from '../../platform/index.js';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type ImageType = { ext: 'jpg' | 'png' | 'webp'; mime: string };

// The declared content type and file name are ignored: only the leading bytes decide.
export function detectImage(b: Buffer): ImageType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (
    b.length >= 12 &&
    b.subarray(0, 4).toString('latin1') === 'RIFF' &&
    b.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

export const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

// Extracts the part named "file" from a multipart/form-data body.
export function parseMultipartFile(body: Buffer, contentType: string): Buffer | null {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = m?.[1] ?? m?.[2];
  if (!boundary) throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'multipart/form-data expected');
  const delim = Buffer.from(`--${boundary}`);
  let pos = body.indexOf(delim);
  while (pos !== -1) {
    const start = pos + delim.length;
    if (body.subarray(start, start + 2).toString('latin1') === '--') return null;
    const headEnd = body.indexOf('\r\n\r\n', start);
    if (headEnd === -1) return null;
    const next = body.indexOf(delim, headEnd + 4);
    if (next === -1) return null;
    const head = body.subarray(start, headEnd).toString('latin1');
    if (/\bname="file"/i.test(head)) return body.subarray(headEnd + 4, next - 2);
    pos = next;
  }
  return null;
}
