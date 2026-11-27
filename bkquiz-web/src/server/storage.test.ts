import { describe, expect, it } from 'vitest';
import { extractPromptImage, imageMarkdown, isAllowedImageUrl, parseImageLine } from '@/utils/questionImage';
import { detectImageType, MAX_IMAGE_BYTES, publicUrlFor, storageConfig, validateImageUpload } from './storage';

const PNG = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]);
const JPG = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const GIF = new TextEncoder().encode('GIF89a......');
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe('validateImageUpload', () => {
  it('accepts PNG, JPEG and WebP by content', () => {
    expect(detectImageType(PNG)?.contentType).toBe('image/png');
    expect(detectImageType(JPG)?.ext).toBe('jpg');
    expect(detectImageType(WEBP)?.contentType).toBe('image/webp');
    expect(validateImageUpload(1000, PNG)).toEqual({ ok: true, type: { ext: 'png', contentType: 'image/png' } });
  });

  it('rejects GIF, SVG (script inside) and anything else', () => {
    expect(validateImageUpload(1000, GIF)).toEqual({ ok: false, error: 'UNSUPPORTED_IMAGE' });
    expect(validateImageUpload(1000, SVG)).toEqual({ ok: false, error: 'UNSUPPORTED_IMAGE' });
    expect(validateImageUpload(1000, new Uint8Array())).toEqual({ ok: false, error: 'UNSUPPORTED_IMAGE' });
  });

  it('size: 1 byte … 2 MB', () => {
    expect(validateImageUpload(0, PNG)).toEqual({ ok: false, error: 'EMPTY_FILE' });
    expect(validateImageUpload(MAX_IMAGE_BYTES, PNG).ok).toBe(true);
    expect(validateImageUpload(MAX_IMAGE_BYTES + 1, PNG)).toEqual({ ok: false, error: 'FILE_TOO_LARGE' });
  });
});

describe('storageConfig', () => {
  const env = { S3_ENDPOINT: 'http://localhost:9000/', S3_BUCKET: 'bkquiz-media', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's' };

  it('MinIO default: public URL is <endpoint>/<bucket>/<key>', () => {
    const c = storageConfig(env)!;

    expect(c.region).toBe('us-east-1');
    expect(publicUrlFor(c, 'questions/u/a.png')).toBe('http://localhost:9000/bkquiz-media/questions/u/a.png');
  });

  it('Supabase: S3_PUBLIC_BASE_URL overrides the public URL', () => {
    const c = storageConfig({ ...env, S3_ENDPOINT: 'https://ref.supabase.co/storage/v1/s3', S3_PUBLIC_BASE_URL: 'https://ref.supabase.co/storage/v1/object/public/bkquiz-media/' })!;

    expect(publicUrlFor(c, 'k.png')).toBe('https://ref.supabase.co/storage/v1/object/public/bkquiz-media/k.png');
  });

  it('missing variables → null', () => {
    expect(storageConfig({ ...env, S3_SECRET_ACCESS_KEY: '' })).toBeNull();
    expect(storageConfig({})).toBeNull();
  });
});

describe('question image markdown', () => {
  it('parses a whole-line ![alt](url)', () => {
    expect(parseImageLine('  ![Sơ đồ mạch](https://x.test/a.png) ')).toEqual({ alt: 'Sơ đồ mạch', url: 'https://x.test/a.png' });
    expect(parseImageLine('![](http://localhost:9000/b/c.webp)')).toEqual({ alt: '', url: 'http://localhost:9000/b/c.webp' });
  });

  it('ignores inline images, relative / javascript: URLs and broken syntax', () => {
    expect(parseImageLine('Xem ![a](https://x.test/a.png) bên dưới')).toBeNull();
    expect(parseImageLine('![a](assets/a.png)')).toBeNull();
    expect(parseImageLine('![a](javascript:alert(1))')).toBeNull();
    expect(parseImageLine('![a](https://x.test/a b.png)')).toBeNull();
    expect(isAllowedImageUrl(`https://x.test/${'a'.repeat(1000)}`)).toBe(false);
  });

  it('extracts the first image line from the prompt', () => {
    expect(extractPromptImage('Quan sát hình:\n![mạch](https://x.test/m.png)\nTính I?')).toEqual({
      prompt: 'Quan sát hình:\nTính I?',
      image: { alt: 'mạch', url: 'https://x.test/m.png' },
    });
    expect(extractPromptImage('Không có ảnh')).toEqual({ prompt: 'Không có ảnh', image: null });
  });

  it('imageMarkdown round-trips and strips brackets from alt', () => {
    const md = imageMarkdown({ alt: 'a [b]\nc', url: 'https://x.test/a.png' });

    expect(md).toBe('![a  b  c](https://x.test/a.png)');
    expect(parseImageLine(md)?.url).toBe('https://x.test/a.png');
  });
});
