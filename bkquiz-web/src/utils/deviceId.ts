const DEVICE_KEY = 'bkquiz_device_id';

/**
 * Mã thiết bị ngẫu nhiên lưu trong localStorage của trình duyệt — dùng để gắn cờ đổi thiết bị /
 * một thiết bị làm bài cho nhiều tài khoản. Không chứa thông tin cá nhân.
 * Dùng crypto.getRandomValues (chạy cả trên http qua LAN; randomUUID chỉ có ở https/localhost).
 * localStorage bị chặn (chế độ riêng tư…) → null, request vẫn chạy bình thường.
 */
export function getDeviceId(): string | null {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id || !/^[\w-]{8,64}$/.test(id)) {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Header gửi kèm các request của trang làm bài (`state`, `answers`, `events`). */
export function deviceHeaders(): Record<string, string> {
  const id = getDeviceId();
  return id ? { 'x-bkquiz-device': id } : {};
}
