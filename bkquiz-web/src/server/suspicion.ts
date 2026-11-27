/**
 * Luật gắn cờ bài làm nghi vấn — hàm thuần, có unit test ở `suspicion.test.ts`.
 *
 * Nguyên tắc: chỉ GỢI Ý cho giáo viên, không tự trừ điểm hay khoá bài. Mỗi cờ kèm số liệu để giáo viên
 * tự đánh giá (ví dụ "rời trang 4 lần, tổng 2 phút 10 giây").
 *
 * Không dùng IP: cả lớp thường chung một IP Wi-Fi trường (NAT) → luật theo IP gắn cờ sai hàng loạt.
 * Thay bằng mã thiết bị ngẫu nhiên lưu trong localStorage của trình duyệt.
 */

export type FlagSeverity = 'warn' | 'high';
export type FlagCode = 'TAB_AWAY' | 'FAST_SUBMIT' | 'DEVICE_CHANGED' | 'SHARED_DEVICE' | 'TOKEN_GUESSING' | 'COPY_PASTE';

export type SuspicionFlag = {
  code: FlagCode;
  severity: FlagSeverity;
  /** Số liệu cho câu mô tả (i18n) */
  params: Record<string, number>;
};

export const THRESHOLDS = {
  /** Rời trang (ẩn tab hoặc chuyển cửa sổ) */
  awayCountWarn: 3,
  awayMsWarn: 60_000,
  awayCountHigh: 10,
  awayMsHigh: 5 * 60_000,
  /** Nộp nhanh: dưới max(60 s, 10 s × số câu) mà điểm ≥ 80% */
  fastSubmitMinSeconds: 60,
  fastSubmitSecondsPerQuestion: 10,
  fastSubmitScoreRatio: 0.8,
  /** Nhập token sai trong cả bài */
  tokenFailWarn: 3,
} as const;

export type SuspicionInput = {
  tabHiddenCount: number;
  tabHiddenMs: number;
  blurCount: number;
  blurMs: number;
  copyCount: number;
  pasteCount: number;
  /** Số thiết bị khác nhau đã làm bài này (thiết bị đầu + các device_changed) */
  deviceCount: number;
  /** Số tài khoản KHÁC trong cùng phiên đã dùng chung một thiết bị với bài này */
  sharedDeviceAccounts: number;
  /** Số lần nhập token sai (verify_fail + locked) */
  tokenFailCount: number;
  assignedCount: number;
  /** Chỉ khi đã nộp */
  submitted: { durationSeconds: number; score: number } | null;
};

export function evaluateFlags(input: SuspicionInput): SuspicionFlag[] {
  const flags: SuspicionFlag[] = [];
  const T = THRESHOLDS;

  const awayCount = input.tabHiddenCount + input.blurCount;
  const awayMs = input.tabHiddenMs + input.blurMs;
  if (awayCount >= T.awayCountWarn || awayMs >= T.awayMsWarn) {
    flags.push({
      code: 'TAB_AWAY',
      severity: awayCount >= T.awayCountHigh || awayMs >= T.awayMsHigh ? 'high' : 'warn',
      params: { count: awayCount, seconds: Math.round(awayMs / 1000) },
    });
  }

  if (input.sharedDeviceAccounts > 0) {
    flags.push({ code: 'SHARED_DEVICE', severity: 'high', params: { accounts: input.sharedDeviceAccounts } });
  }

  if (input.deviceCount >= 2) {
    flags.push({ code: 'DEVICE_CHANGED', severity: 'warn', params: { devices: input.deviceCount } });
  }

  if (input.submitted && input.assignedCount > 0) {
    const limit = Math.max(T.fastSubmitMinSeconds, T.fastSubmitSecondsPerQuestion * input.assignedCount);
    const ratio = input.submitted.score / input.assignedCount;
    if (input.submitted.durationSeconds < limit && ratio >= T.fastSubmitScoreRatio) {
      flags.push({
        code: 'FAST_SUBMIT',
        severity: 'warn',
        params: { seconds: Math.round(input.submitted.durationSeconds), percent: Math.round(ratio * 100) },
      });
    }
  }

  if (input.tokenFailCount >= T.tokenFailWarn) {
    flags.push({ code: 'TOKEN_GUESSING', severity: 'warn', params: { count: input.tokenFailCount } });
  }

  if (input.pasteCount > 0) {
    flags.push({ code: 'COPY_PASTE', severity: 'warn', params: { paste: input.pasteCount, copy: input.copyCount } });
  }

  // Cờ mức cao lên trước
  return flags.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1));
}

/** Mã thiết bị hợp lệ từ header `x-bkquiz-device` (client tạo bằng crypto.randomUUID). */
export function parseDeviceId(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const v = raw.trim();
  return /^[\w-]{8,64}$/.test(v) ? v : null;
}

/**
 * Với mỗi bài làm: số tài khoản khác trong cùng phiên đã dùng chung ít nhất một thiết bị.
 * `devicesByAttempt`: attemptId → { userId, devices }.
 */
export function countSharedDeviceAccounts(
  devicesByAttempt: Map<string, { userId: string; devices: Set<string> }>,
): Map<string, number> {
  const usersByDevice = new Map<string, Set<string>>();
  for (const { userId, devices } of devicesByAttempt.values()) {
    for (const d of devices) {
      let users = usersByDevice.get(d);
      if (!users) {
        users = new Set();
        usersByDevice.set(d, users);
      }
      users.add(userId);
    }
  }
  const result = new Map<string, number>();
  for (const [attemptId, { userId, devices }] of devicesByAttempt) {
    const others = new Set<string>();
    for (const d of devices) {
      for (const u of usersByDevice.get(d) ?? []) {
        if (u !== userId) {
          others.add(u);
        }
      }
    }
    result.set(attemptId, others.size);
  }
  return result;
}
