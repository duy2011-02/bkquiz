/**
 * Che bớt email để hiển thị cho người khác: giữ tối đa 2 ký tự đầu của phần tên và giữ nguyên tên miền.
 * `nguyenvana@hust.edu.vn` → `ng***@hust.edu.vn`, `a@b.c` → `a***@b.c`. Không hợp lệ / rỗng → null.
 */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) {
    return null;
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local.slice(0, Math.min(2, local.length - 1) || 1)}***@${domain}`;
}
