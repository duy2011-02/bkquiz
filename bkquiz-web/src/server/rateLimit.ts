import { NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';

/**
 * Rate limit cho API, đếm theo cửa sổ cố định trong bảng `RateLimit` (Postgres).
 *
 * Vì sao Postgres: chạy đúng cả local lẫn nhiều instance trên Vercel (bộ đếm trong RAM thì mỗi instance đếm riêng),
 * không thêm dịch vụ ngoài. Mỗi request bị giới hạn tốn 1 lần ghi DB → chỉ áp cho endpoint nhạy cảm / ghi dữ liệu,
 * không áp cho các GET được poll liên tục (`attempts/*\/state`, `sessions/*\/status`, `teacherToken`, report…).
 *
 * - Vượt giới hạn → 429 `{ error: 'RATE_LIMITED', retryAfterSeconds }` + header `Retry-After`.
 * - Lỗi DB khi đếm → ghi log và cho qua (fail-open): rate limit không được làm hỏng buổi thi.
 * - Tắt bằng env `RATE_LIMIT_DISABLED=1`.
 */
export const RATE_LIMITS = {
  /** Nhập token checkpoint (đã có thêm cooldown theo attempt trong checkpointPolicy). */
  verifyToken: { limit: 10, windowSeconds: 60 },
  /** `classes/join`, `classes/preview` — theo tài khoản. */
  classJoin: { limit: 10, windowSeconds: 60 },
  /**
   * `classes/join`, `classes/preview` — theo IP. Cao hơn nhiều so với theo tài khoản vì cả lớp dùng chung
   * Wi-Fi trường (NAT) và thường tham gia lớp cùng lúc (mỗi sinh viên gọi preview + join).
   */
  classJoinIp: { limit: 200, windowSeconds: 60 },
  /** `sessions/[id]/join`, `attempts/[id]/start`. */
  sessionJoin: { limit: 20, windowSeconds: 60 },
  /** PUT `attempts/[id]/answers` — client gửi sau 500 ms debounce, tối đa ~2 lần/giây khi bấm liên tục. */
  answers: { limit: 180, windowSeconds: 60 },
  submit: { limit: 10, windowSeconds: 60 },
  poolImport: { limit: 5, windowSeconds: 600 },
  /** POST `uploads/question-image` — ảnh ≤ 2 MB; 30 ảnh / 10 phút đủ để soạn một bộ câu hỏi. */
  imageUpload: { limit: 30, windowSeconds: 600 },
  /** POST `attempts/[id]/events` — client gửi theo lô (≤ 50 sự kiện) mỗi 10 s hoặc khi quay lại tab. */
  proctorEvents: { limit: 60, windowSeconds: 60 },
  /** Tạo / sửa / xoá chung (giáo viên, quản lý lớp, đổi vai trò). */
  write: { limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, { limit: number; windowSeconds: number }>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export type RateLimitResult = {
  ok: boolean;
  count: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

/** Đầu cửa sổ chứa `now` (cửa sổ căn theo epoch, dài `windowSeconds`). */
export function getWindowStart(now: Date, windowSeconds: number): Date {
  const windowMs = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/** Số giây (làm tròn lên, tối thiểu 1) tới khi cửa sổ hiện tại kết thúc. */
export function getRetryAfterSeconds(now: Date, windowSeconds: number): number {
  const windowEnd = getWindowStart(now, windowSeconds).getTime() + windowSeconds * 1000;
  return Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000));
}

/** Kết quả với một giá trị đếm đã biết (hàm thuần, dùng trong `checkRateLimit` và test). */
export function evaluateCount(name: RateLimitName, count: number, now: Date): RateLimitResult {
  const { limit, windowSeconds } = RATE_LIMITS[name];
  return {
    ok: count <= limit,
    count,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: getRetryAfterSeconds(now, windowSeconds),
  };
}

/**
 * IP của client: phần tử đầu của `x-forwarded-for` (Vercel / proxy đặt), rồi `x-real-ip`, không có thì `'unknown'`.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first) {
    return first;
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  return realIp || 'unknown';
}

export function isRateLimitDisabled(): boolean {
  return process.env.RATE_LIMIT_DISABLED === '1';
}

/**
 * Tăng bộ đếm của `name` + `identifier` trong cửa sổ hiện tại và trả kết quả.
 * Một câu SQL nguyên tử (INSERT … ON CONFLICT DO UPDATE … RETURNING) → đúng cả khi nhiều request đồng thời.
 */
export async function checkRateLimit(name: RateLimitName, identifier: string, now = new Date()): Promise<RateLimitResult> {
  if (isRateLimitDisabled()) {
    return evaluateCount(name, 0, now);
  }
  const key = `${name}:${identifier}`;
  const windowStart = getWindowStart(now, RATE_LIMITS[name].windowSeconds);
  try {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimit" ("key", "windowStart", "count")
      VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimit"."count" + 1
      RETURNING "count"
    `;
    return evaluateCount(name, Number(rows[0]?.count ?? 1), now);
  } catch (err) {
    console.error('[rateLimit] counter failed, allowing request', { key, err });
    return evaluateCount(name, 0, now);
  }
}

export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: 'RATE_LIMITED', retryAfterSeconds },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}

/**
 * Kiểm tra 1 hoặc nhiều bộ đếm (ví dụ theo tài khoản và theo IP). Mọi bộ đếm đều được tăng.
 * Trả `NextResponse` 429 nếu có bộ đếm vượt giới hạn, ngược lại `null`.
 *
 * Dùng ngay sau `requireUser()`:
 * ```ts
 * const limited = await enforceRateLimit('write', `user:${userId}`);
 * if (limited) {
 *   return limited;
 * }
 * ```
 */
export async function enforceRateLimit(
  name: RateLimitName,
  identifier: string,
  ...more: Array<[RateLimitName, string]>
): Promise<NextResponse | null> {
  const checks: Array<[RateLimitName, string]> = [[name, identifier], ...more];
  const results = await Promise.all(checks.map(([n, id]) => checkRateLimit(n, id)));
  const blocked = results.filter(r => !r.ok);
  if (blocked.length === 0) {
    return null;
  }
  return rateLimitedResponse(Math.max(...blocked.map(r => r.retryAfterSeconds)));
}

/** Xoá bộ đếm cũ hơn `olderThanHours` giờ (gọi từ cron `api/sessions/auto`). Trả số bản ghi đã xoá. */
export async function cleanupRateLimits(olderThanHours = 24, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanHours * 3600 * 1000);
  const { count } = await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: cutoff } } });
  return count;
}
