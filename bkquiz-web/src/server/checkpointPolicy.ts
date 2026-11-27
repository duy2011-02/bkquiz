/**
 * Luật checkpoint (nhập token giữa giờ) — hàm thuần, có unit test ở `checkpointPolicy.test.ts`.
 * Dùng bởi `api/attempts/[attemptId]/verifyToken`, `api/attempts/[attemptId]/state`, `api/sessions/[sessionId]/join`.
 */

/** Từ lần nhập sai thứ 3: phải chờ trước khi nhập lại. */
export const COOLDOWN_AFTER_FAILS = 3;
export const COOLDOWN_SECONDS = 30;
/** Từ lần nhập sai thứ 6: khoá bài. */
export const LOCK_AFTER_FAILS = 6;
export const LOCK_SECONDS = 5 * 60;
/** Sau mốc checkpoint, sinh viên còn bấy nhiêu giây (cảnh báo) trước khi bị chặn làm bài. */
export const GRACE_SECONDS_BEFORE_BLOCK = 5;
/** Khoảng ngẫu nhiên giữa 2 checkpoint. */
export const CHECKPOINT_MIN_SECONDS = 240;
export const CHECKPOINT_MAX_SECONDS = 300;

/** Số nguyên ngẫu nhiên trong [min, max]. `random` trả về [0, 1) như `Math.random`. */
export function randomInt(min: number, max: number, random: () => number = Math.random): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

/**
 * Chỉ cho test e2e: `BKQUIZ_CHECKPOINT_SECONDS` rút ngắn khoảng giữa 2 checkpoint.
 * Chỉ có tác dụng khi `DEV_BYPASS_AUTH=1` (chế độ dev) → không thể bật nhầm trên bản chạy thật.
 */
export function checkpointIntervalOverride(env: Record<string, string | undefined> = process.env): number | null {
  if (env.DEV_BYPASS_AUTH !== '1' || !env.BKQUIZ_CHECKPOINT_SECONDS) {
    return null;
  }
  const seconds = Number(env.BKQUIZ_CHECKPOINT_SECONDS);
  return Number.isInteger(seconds) && seconds >= 5 && seconds <= CHECKPOINT_MAX_SECONDS ? seconds : null;
}

/** Mốc checkpoint kế tiếp: sau `now` từ 240 đến 300 giây. */
export function nextCheckpointDueAt(now: Date, random: () => number = Math.random): Date {
  const override = checkpointIntervalOverride();
  const seconds = override ?? randomInt(CHECKPOINT_MIN_SECONDS, CHECKPOINT_MAX_SECONDS, random);
  return new Date(now.getTime() + seconds * 1000);
}

/** Trạng thái sau một lần nhập token sai. */
export function applyFailedVerify(previousFailedCount: number, now: Date): {
  failedCount: number;
  cooldownUntil: Date | null;
  lockedUntil: Date | null;
  locked: boolean;
} {
  const failedCount = previousFailedCount + 1;
  const cooldownUntil = failedCount >= COOLDOWN_AFTER_FAILS ? new Date(now.getTime() + COOLDOWN_SECONDS * 1000) : null;
  const lockedUntil = failedCount >= LOCK_AFTER_FAILS ? new Date(now.getTime() + LOCK_SECONDS * 1000) : null;
  return { failedCount, cooldownUntil, lockedUntil, locked: lockedUntil !== null };
}

/** Đang trong thời gian chờ sau nhiều lần nhập sai. */
export function isInCooldown(cooldownUntil: Date | null, now: Date): boolean {
  return cooldownUntil ? cooldownUntil.getTime() > now.getTime() : false;
}

/**
 * Bài đang bị khoá: còn trong `lockedUntil`; nếu không có `lockedUntil` thì theo `status === 'locked'`.
 * (Hết `lockedUntil` thì coi như hết khoá dù `status` vẫn là `locked`.)
 */
export function isAttemptLocked(lockedUntil: Date | null, status: string, now: Date): boolean {
  return lockedUntil ? lockedUntil.getTime() > now.getTime() : status === 'locked';
}

/**
 * Pha checkpoint tại thời điểm `now`:
 * - `warning`: đã qua mốc nhưng còn trong `GRACE_SECONDS_BEFORE_BLOCK` giây ân hạn;
 * - `due`: hết ân hạn → chặn làm bài tới khi nhập token đúng.
 */
export function getCheckpointPhase(nextDueAt: Date | null, now: Date): { warning: boolean; due: boolean } {
  if (!nextDueAt) {
    return { warning: false, due: false };
  }
  const dueMs = nextDueAt.getTime();
  const blockMs = dueMs + GRACE_SECONDS_BEFORE_BLOCK * 1000;
  return {
    warning: dueMs <= now.getTime() && blockMs > now.getTime(),
    due: blockMs <= now.getTime(),
  };
}
