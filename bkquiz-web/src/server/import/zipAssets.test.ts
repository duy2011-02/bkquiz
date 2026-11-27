import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { parsePoolMarkdown } from './markdownPool';
import { collectAssetRefs, MAX_ZIP_IMAGES, normalizeAssetPath, questionsMdPath, rewriteAssetRefs, uploadZipAssets } from './zipAssets';

const PNG = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0]);
const CONFIG = { endpoint: 'http://s3', region: 'us-east-1', accessKeyId: 'k', secretAccessKey: 's', bucket: 'b', publicBaseUrl: 'http://s3/b' };
const fakeUpload = vi.fn(async (_c: unknown, key: string) => `http://s3/b/${key}`);

describe('normalizeAssetPath', () => {
  it('accepts relative paths inside the zip', () => {
    expect(normalizeAssetPath('assets/a.png')).toBe('assets/a.png');
    expect(normalizeAssetPath('./assets/a.png')).toBe('assets/a.png');
    expect(normalizeAssetPath('assets\\sub\\b.jpg')).toBe('assets/sub/b.jpg');
    expect(normalizeAssetPath('assets/s%C6%A1%20%C4%91%E1%BB%93.png')).toBe('assets/sơ đồ.png');
  });

  it('rejects URLs, absolute paths and traversal', () => {
    expect(normalizeAssetPath('https://x.test/a.png')).toBeNull();
    expect(normalizeAssetPath('data:image/png;base64,AAA')).toBeNull();
    expect(normalizeAssetPath('C:/x/a.png')).toBeNull();
    expect(normalizeAssetPath('/etc/a.png')).toBeNull();
    expect(normalizeAssetPath('../a.png')).toBeNull();
    expect(normalizeAssetPath('assets/../../a.png')).toBeNull();
    expect(normalizeAssetPath('assets//a.png')).toBeNull();
    expect(normalizeAssetPath('%E0%A4%A')).toBeNull();
  });
});

describe('collectAssetRefs / rewriteAssetRefs', () => {
  const md = 'Câu 1\n![mạch](assets/a.png)\nCâu 2\n  ![lặp](./assets/a.png)\n![ngoài](https://x.test/c.png)\nXem ![giữa dòng](assets/z.png) nhé\n![b](assets/b.jpg)';

  it('collects whole-line relative images once, in order', () => {
    expect(collectAssetRefs(md)).toEqual(['assets/a.png', 'assets/b.jpg']);
  });

  it('rewrites only mapped refs, keeping indentation and alt', () => {
    const out = rewriteAssetRefs(md, new Map([['assets/a.png', 'http://s3/b/q/1.png']]));

    expect(out).toContain('![mạch](http://s3/b/q/1.png)');
    expect(out).toContain('  ![lặp](http://s3/b/q/1.png)');
    expect(out).toContain('![b](assets/b.jpg)');
    expect(out).toContain('![ngoài](https://x.test/c.png)');
  });
});

describe('uploadZipAssets', () => {
  it('uploads valid images relative to questions.md, warns about missing / wrong type / too large', async () => {
    const zip = new JSZip();
    zip.file('pack/questions.md', '# x');
    zip.file('pack/assets/a.png', PNG);
    zip.file('pack/assets/gif.png', new TextEncoder().encode('GIF89a..........'));
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(PNG);
    zip.file('pack/assets/big.png', big);

    fakeUpload.mockClear();
    const r = await uploadZipAssets(zip, ['assets/a.png', 'assets/gif.png', 'assets/big.png', 'assets/missing.png'], {
      userId: 'u1',
      config: CONFIG,
      mdPath: questionsMdPath(zip),
      upload: fakeUpload,
    });

    expect([...r.map.keys()]).toEqual(['assets/a.png']);
    expect(r.map.get('assets/a.png')).toMatch(/^http:\/\/s3\/b\/questions\/u1\/.+\.png$/);
    expect(fakeUpload).toHaveBeenCalledTimes(1);
    expect(r.warnings).toEqual([
      'assets/gif.png: không phải ảnh PNG, JPEG hoặc WebP.',
      'assets/big.png: ảnh lớn hơn 2 MB.',
      'assets/missing.png: không có trong file zip.',
    ]);
  });

  it('stops at the per-import image limit; storage errors become warnings', async () => {
    const zip = new JSZip();
    const refs = Array.from({ length: MAX_ZIP_IMAGES + 2 }, (_, i) => `assets/${i}.png`);
    refs.forEach(r => zip.file(r, PNG));
    const failing = vi.fn(async () => {
      throw new Error('down');
    });
    const r = await uploadZipAssets(zip, refs, { userId: 'u', config: CONFIG, upload: failing });

    expect(failing).toHaveBeenCalledTimes(MAX_ZIP_IMAGES);
    expect(r.map.size).toBe(0);
    expect(r.warnings.at(-1)).toContain('2 ảnh vượt giới hạn');
  });

  it('end to end: rewritten markdown is parsed as a question image', async () => {
    const md = '---\npool:\n  name: "Zip"\n---\n\n# QUESTION:\nTính I?\n![Sơ đồ](assets/a.png)\n## TAGS: ["t"]\n## ANSWER:\n(x) 1 A\n( ) 2 A';
    const parsed = parsePoolMarkdown(rewriteAssetRefs(md, new Map([['assets/a.png', 'http://s3/b/questions/u/x.png']])));

    expect(parsed.questions[0]).toMatchObject({ prompt: 'Tính I?', image: { url: 'http://s3/b/questions/u/x.png', alt: 'Sơ đồ' } });
  });
});
