import { describe, expect, it } from 'vitest';
import { detectImage, parseMultipartFile } from './images.js';

describe('detectImage', () => {
  it('recognises jpeg, png and webp by magic bytes', () => {
    expect(detectImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]))?.ext).toBe('jpg');
    expect(detectImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.ext).toBe(
      'png',
    );
    expect(detectImage(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))?.ext).toBe('webp');
  });

  it('rejects everything else, whatever the name says', () => {
    expect(detectImage(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
    expect(detectImage(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImage(Buffer.alloc(0))).toBeNull();
  });
});

describe('parseMultipartFile', () => {
  it('extracts the file part and ignores other fields', () => {
    const body = Buffer.from(
      '--X\r\nContent-Disposition: form-data; name="note"\r\n\r\nhi\r\n' +
        '--X\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\n\r\nDATA\r\n--X--\r\n',
    );
    expect(parseMultipartFile(body, 'multipart/form-data; boundary=X')?.toString()).toBe('DATA');
  });

  it('returns null when there is no file part', () => {
    const body = Buffer.from(
      '--X\r\nContent-Disposition: form-data; name="a"\r\n\r\nv\r\n--X--\r\n',
    );
    expect(parseMultipartFile(body, 'multipart/form-data; boundary=X')).toBeNull();
  });
});
