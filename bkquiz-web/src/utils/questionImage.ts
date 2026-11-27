/**
 * Ảnh của câu hỏi trong Markdown (nhập / xuất / "Sửa bằng Markdown"): một dòng riêng `![mô tả](url)` trong đề bài.
 * Hàm thuần, dùng chung cho server (parser import) và kiểm tra dữ liệu API.
 */

export const IMAGE_URL_MAX = 1000;
export const IMAGE_ALT_MAX = 300;

export type QuestionImage = { url: string; alt: string };

/** Chỉ nhận URL http(s) tuyệt đối, ≤ 1000 ký tự, không có khoảng trắng / ngoặc (để ghi lại được vào Markdown). */
export function isAllowedImageUrl(url: string): boolean {
  if (url.length === 0 || url.length > IMAGE_URL_MAX || /[\s()<>]/.test(url)) {
    return false;
  }
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * `![alt](src)` chiếm trọn một dòng → `{ alt, src }` (chưa kiểm tra `src`: có thể là URL hoặc đường dẫn tương đối
 * như `assets/a.png` trong file `.zip`). Phân tích bằng thao tác chuỗi (không regex lùi).
 */
export function parseImageLineRaw(line: string): { alt: string; src: string } | null {
  const s = line.trim();
  if (!s.startsWith('![') || !s.endsWith(')')) {
    return null;
  }
  const mid = s.indexOf('](');
  if (mid < 0) {
    return null;
  }
  const alt = s.slice(2, mid).trim();
  const src = s.slice(mid + 2, -1).trim();
  if (!src || alt.includes(']')) {
    return null;
  }
  return { alt, src };
}

/** `![alt](url)` chiếm trọn một dòng, url http(s) hợp lệ → ảnh; ngược lại `null`. */
export function parseImageLine(line: string): QuestionImage | null {
  const raw = parseImageLineRaw(line);
  if (!raw || !isAllowedImageUrl(raw.src)) {
    return null;
  }
  return { url: raw.src, alt: raw.alt.slice(0, IMAGE_ALT_MAX) };
}

/** Tách dòng ảnh đầu tiên khỏi đề bài. Các dòng `![…](…)` khác (nếu có) giữ nguyên trong đề. */
export function extractPromptImage(prompt: string): { prompt: string; image: QuestionImage | null } {
  const lines = prompt.split('\n');
  const idx = lines.findIndex(l => parseImageLine(l) !== null);
  if (idx < 0) {
    return { prompt, image: null };
  }
  const image = parseImageLine(lines[idx]!)!;
  lines.splice(idx, 1);
  return { prompt: lines.join('\n').trim(), image };
}

/** Dòng Markdown để xuất ảnh (bỏ ký tự làm hỏng cú pháp trong mô tả). */
export function imageMarkdown(image: QuestionImage): string {
  const alt = image.alt.replace(/[[\]\n\r]/g, ' ').trim();
  return `![${alt}](${image.url})`;
}
