import { getCheckpointPhase, isAttemptLocked, isInCooldown } from '@/server/checkpointPolicy';

/**
 * Trạng thái trực tiếp của một sinh viên trong phiên thi — dùng cho trang giám sát của giáo viên.
 * Hàm thuần, có unit test ở `liveStatus.test.ts`.
 */
export type LiveStatus
  = | 'not_joined' // trong lớp nhưng chưa vào phiên
    | 'not_started' // đã vào phòng chờ / chưa bấm bắt đầu
    | 'working'
    | 'checkpoint_due' // tới mốc checkpoint, đang chờ nhập token
    | 'cooldown' // nhập sai nhiều lần, đang phải chờ
    | 'locked' // bị khoá sau 6 lần sai → cần giáo viên mở khoá
    | 'offline' // không thấy tín hiệu từ máy sinh viên quá OFFLINE_AFTER_SECONDS
    | 'time_up' // hết giờ (hoặc phiên đã kết thúc) mà chưa nộp
    | 'submitted';

/** Sinh viên poll `state` mỗi 1,5 s; `lastSeenAt` ghi tối đa 10 s/lần → quá 20 s coi là mất kết nối. */
export const OFFLINE_AFTER_SECONDS = 20;
/** Khoảng tối thiểu giữa 2 lần ghi `lastSeenAt` (giảm số lần ghi DB khi poll 1,5 s/lần). */
export const LAST_SEEN_WRITE_INTERVAL_SECONDS = 10;

/** Thứ tự hiển thị trên trang giám sát: cần giáo viên chú ý trước. */
export const LIVE_STATUS_ORDER: LiveStatus[] = [
  'locked',
  'offline',
  'cooldown',
  'checkpoint_due',
  'time_up',
  'working',
  'not_started',
  'not_joined',
  'submitted',
];

export type LiveStatusInput = {
  status: string; // AttemptStatus
  attemptStartedAt: Date | null;
  submittedAt?: Date | null;
  lockedUntil: Date | null;
  cooldownUntil: Date | null;
  nextDueAt: Date | null;
  lastSeenAt: Date | null;
  /** Kết quả `calculateAttemptEndTime` (null nếu không giới hạn thời gian / chưa bắt đầu). */
  attemptEndTime: Date | null;
};

export function deriveLiveStatus(
  attempt: LiveStatusInput,
  sessionStatus: 'lobby' | 'active' | 'ended',
  now: Date,
): LiveStatus {
  if (attempt.status === 'submitted') {
    return 'submitted';
  }
  if (sessionStatus === 'ended') {
    return 'time_up';
  }
  if (isAttemptLocked(attempt.lockedUntil, attempt.status, now)) {
    return 'locked';
  }
  if (!attempt.attemptStartedAt || sessionStatus === 'lobby') {
    return 'not_started';
  }
  if (attempt.attemptEndTime && now.getTime() >= attempt.attemptEndTime.getTime()) {
    return 'time_up';
  }
  // Bài làm trước khi có cột lastSeenAt: lấy thời điểm bắt đầu làm bài
  const lastSeen = attempt.lastSeenAt ?? attempt.attemptStartedAt;
  if (now.getTime() - lastSeen.getTime() > OFFLINE_AFTER_SECONDS * 1000) {
    return 'offline';
  }
  if (isInCooldown(attempt.cooldownUntil, now)) {
    return 'cooldown';
  }
  const phase = getCheckpointPhase(attempt.nextDueAt, now);
  if (phase.due || phase.warning) {
    return 'checkpoint_due';
  }
  return 'working';
}

/** Giáo viên mở khoá được khi bài đang bị khoá hoặc đang phải chờ vì nhập sai. */
export function canUnlock(attempt: Pick<LiveStatusInput, 'status' | 'lockedUntil' | 'cooldownUntil'>, now: Date): boolean {
  if (attempt.status === 'submitted') {
    return false;
  }
  return attempt.status === 'locked'
    || isAttemptLocked(attempt.lockedUntil, attempt.status, now)
    || isInCooldown(attempt.cooldownUntil, now);
}
