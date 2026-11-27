import type JSZip from 'jszip';
import type { StorageConfig } from '@/server/storage';
import { nanoid } from 'nanoid';
import { putPublicObject, validateImageUpload } from '@/server/storage';
import { isAllowedImageUrl, parseImageLineRaw } from '@/utils/questionImage';

/**
 * Nhập `.zip` có thư mục ảnh (docs/import.md mục 1.1): `questions.md` dùng `![mô tả](assets/a.png)`,
 * server đọc ảnh trong zip, kiểm tra (PNG / JPEG / WebP theo magic bytes, ≤ 2 MB), tải lên kho ảnh rồi thay đường dẫn
 * tương đối bằng URL công khai — sau đó parser xử lý như ảnh thường (Task 6.5).
 */

export const MAX_ZIP_IMAGES = 100;

/**
 * Đường dẫn ảnh tương đối trong zip: bỏ `./`, giải mã `%20`, đổi `\` thành `/`.
 * `null` nếu là URL / có scheme, đường dẫn tuyệt đối, hoặc có `..` / `.` / đoạn rỗng.
 */
export function normalizeAssetPath(src: string): string | null {
  if (isAllowedImageUrl(src) || /^[a-z][\w+.-]*:/i.test(src)) {
    return null;
  }
  let p: string;
  try {
    p = decodeURIComponent(src);
  } catch {
    return null;
  }
  p = p.replace(/\\/g, '/');
  while (p.startsWith('./')) {
    p = p.slice(2);
  }
  if (!p || p.startsWith('/') || p.split('/').some(seg => seg === '' || seg === '.' || seg === '..')) {
    return null;
  }
  return p;
}

/** Các đường dẫn ảnh tương đối (đã chuẩn hoá) ở những dòng ảnh riêng, theo thứ tự xuất hiện, bỏ trùng. */
export function collectAssetRefs(md: string): string[] {
  const seen = new Set<string>();
  for (const line of md.split('\n')) {
    const raw = parseImageLineRaw(line);
    const path = raw ? normalizeAssetPath(raw.src) : null;
    if (path) {
      seen.add(path);
    }
  }
  return [...seen];
}

/** Thay đường dẫn tương đối bằng URL đã tải lên (chỉ ở dòng ảnh riêng); đường dẫn không có trong `map` giữ nguyên. */
export function rewriteAssetRefs(md: string, map: ReadonlyMap<string, string>): string {
  return md
    .split('\n')
    .map((line) => {
      const raw = parseImageLineRaw(line);
      const path = raw ? normalizeAssetPath(raw.src) : null;
      const url = path ? map.get(path) : undefined;
      if (!raw || !url) {
        return line;
      }
      const indent = line.slice(0, line.length - line.trimStart().length);
      return `${indent}![${raw.alt}](${url})`;
    })
    .join('\n');
}

/** Tên (đường dẫn trong zip) của file `questions.md`, để tìm ảnh tương đối theo thư mục chứa nó. */
export function questionsMdPath(zip: JSZip): string | null {
  return zip.file(/(^|\/)questions\.md$/i)[0]?.name ?? null;
}

type Upload = typeof putPublicObject;

/**
 * Đọc từng ảnh trong zip (tìm theo thư mục chứa `questions.md`, rồi theo gốc zip), kiểm tra và tải lên.
 * Trả `map` (đường dẫn → URL) và cảnh báo cho ảnh thiếu / sai loại / quá lớn / vượt giới hạn số ảnh / lỗi kho ảnh.
 */
export async function uploadZipAssets(
  zip: JSZip,
  refs: string[],
  opts: { userId: string; config: StorageConfig; mdPath?: string | null; upload?: Upload },
): Promise<{ map: Map<string, string>; warnings: string[] }> {
  const upload = opts.upload ?? putPublicObject;
  const mdPath = opts.mdPath ?? '';
  const baseDir = mdPath.includes('/') ? mdPath.slice(0, mdPath.lastIndexOf('/') + 1) : '';
  const map = new Map<string, string>();
  const warnings: string[] = [];

  for (const [index, ref] of refs.entries()) {
    if (index >= MAX_ZIP_IMAGES) {
      warnings.push(`${refs.length - MAX_ZIP_IMAGES} ảnh vượt giới hạn ${MAX_ZIP_IMAGES} ảnh mỗi lần nhập nên không được tải lên.`);
      break;
    }
    const file = zip.file(baseDir + ref) ?? zip.file(ref);
    if (!file || file.dir) {
      warnings.push(`${ref}: không có trong file zip.`);
      continue;
    }
    const bytes = await file.async('uint8array');
    const check = validateImageUpload(bytes.length, bytes.subarray(0, 16));
    if (!check.ok) {
      warnings.push(`${ref}: ${check.error === 'FILE_TOO_LARGE' ? 'ảnh lớn hơn 2 MB' : 'không phải ảnh PNG, JPEG hoặc WebP'}.`);
      continue;
    }
    try {
      const url = await upload(opts.config, `questions/${opts.userId}/${nanoid()}.${check.type.ext}`, bytes, check.type.contentType);
      map.set(ref, url);
    } catch {
      warnings.push(`${ref}: không tải lên được kho ảnh.`);
    }
  }
  return { map, warnings };
}
