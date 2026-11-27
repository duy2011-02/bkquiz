import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  rateLimit: { deleteMany: vi.fn() },
}));

vi.mock('@/server/prisma', () => ({ prisma: db }));

const {
  checkRateLimit,
  cleanupRateLimits,
  enforceRateLimit,
  evaluateCount,
  getClientIp,
  getRetryAfterSeconds,
  getWindowStart,
  RATE_LIMITS,
} = await import('./rateLimit');

// 1_800_000_000_000 chia hết cho 60 000 và 600 000 → đầu cửa sổ 60 s và 600 s
const WINDOW_START = 1_800_000_000_000;

/** Giả lập bộ đếm Postgres: trả số lần đã gọi với cùng key + windowStart. */
function fakeCounter() {
  const counts = new Map<string, number>();
  db.$queryRaw.mockImplementation(async (_strings: TemplateStringsArray, key: string, windowStart: Date) => {
    const k = `${key}@${windowStart.toISOString()}`;
    const count = (counts.get(k) ?? 0) + 1;
    counts.set(k, count);
    return [{ count }];
  });
  return counts;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(WINDOW_START + 15_000);
  delete process.env.RATE_LIMIT_DISABLED;
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.RATE_LIMIT_DISABLED;
});

describe('getWindowStart / getRetryAfterSeconds', () => {
  it('aligns to the start of the fixed window', () => {
    expect(getWindowStart(new Date(WINDOW_START + 59_999), 60).getTime()).toBe(WINDOW_START);
    expect(getWindowStart(new Date(WINDOW_START + 60_000), 60).getTime()).toBe(WINDOW_START + 60_000);
    expect(getWindowStart(new Date(WINDOW_START + 599_000), 600).getTime()).toBe(WINDOW_START);
  });

  it('retry-after = seconds until the window ends, at least 1', () => {
    expect(getRetryAfterSeconds(new Date(WINDOW_START), 60)).toBe(60);
    expect(getRetryAfterSeconds(new Date(WINDOW_START + 15_000), 60)).toBe(45);
    expect(getRetryAfterSeconds(new Date(WINDOW_START + 59_900), 60)).toBe(1);
  });
});

describe('evaluateCount', () => {
  it('allows up to the limit and blocks above it', () => {
    const now = new Date(WINDOW_START);
    const { limit } = RATE_LIMITS.verifyToken;

    expect(evaluateCount('verifyToken', limit, now)).toMatchObject({ ok: true, remaining: 0 });
    expect(evaluateCount('verifyToken', limit + 1, now)).toMatchObject({ ok: false, remaining: 0, retryAfterSeconds: 60 });
  });
});

describe('getClientIp', () => {
  const req = (headers: Record<string, string>) => new Request('http://localhost/api/x', { headers });

  it('takes the first x-forwarded-for entry', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip, then unknown', () => {
    expect(getClientIp(req({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(getClientIp(req({}))).toBe('unknown');
  });
});

describe('checkRateLimit', () => {
  it('counts per key within the window', async () => {
    fakeCounter();

    for (let i = 1; i <= 10; i += 1) {
      await expect(checkRateLimit('classJoin', 'user:a')).resolves.toMatchObject({ ok: true, count: i });
    }

    await expect(checkRateLimit('classJoin', 'user:a')).resolves.toMatchObject({ ok: false, count: 11 });
    // Người dùng khác có bộ đếm riêng
    await expect(checkRateLimit('classJoin', 'user:b')).resolves.toMatchObject({ ok: true, count: 1 });
  });

  it('uses the key "<name>:<identifier>" and the window start', async () => {
    fakeCounter();
    await checkRateLimit('submit', 'user:a');

    expect(db.$queryRaw.mock.calls[0]?.[1]).toBe('submit:user:a');
    expect((db.$queryRaw.mock.calls[0]?.[2] as Date).getTime()).toBe(WINDOW_START);
  });

  it('a new window starts a new count', async () => {
    fakeCounter();
    for (let i = 0; i < 11; i += 1) {
      await checkRateLimit('classJoin', 'user:a');
    }
    vi.setSystemTime(WINDOW_START + 60_000);

    await expect(checkRateLimit('classJoin', 'user:a')).resolves.toMatchObject({ ok: true, count: 1 });
  });

  it('fails open when the database errors', async () => {
    db.$queryRaw.mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(checkRateLimit('answers', 'user:a')).resolves.toMatchObject({ ok: true });

    spy.mockRestore();
  });

  it('does nothing when RATE_LIMIT_DISABLED=1', async () => {
    process.env.RATE_LIMIT_DISABLED = '1';

    await expect(checkRateLimit('answers', 'user:a')).resolves.toMatchObject({ ok: true });

    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('enforceRateLimit', () => {
  it('returns null while under the limit', async () => {
    fakeCounter();

    await expect(enforceRateLimit('submit', 'user:a')).resolves.toBeNull();
  });

  it('returns 429 with Retry-After once over the limit', async () => {
    fakeCounter();
    for (let i = 0; i < RATE_LIMITS.submit.limit; i += 1) {
      await enforceRateLimit('submit', 'user:a');
    }
    const res = await enforceRateLimit('submit', 'user:a');

    expect(res?.status).toBe(429);
    expect(res?.headers.get('Retry-After')).toBe('45');
    await expect(res?.json()).resolves.toEqual({ error: 'RATE_LIMITED', retryAfterSeconds: 45 });
  });

  it('checks every counter: blocked by IP even when the user is under the limit', async () => {
    const counts = fakeCounter();
    counts.set(`classJoinIp:ip:1.2.3.4@${new Date(WINDOW_START).toISOString()}`, RATE_LIMITS.classJoinIp.limit);
    const res = await enforceRateLimit('classJoin', 'user:a', ['classJoinIp', 'ip:1.2.3.4']);

    expect(res?.status).toBe(429);
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('a whole class behind one NAT IP can join at once', async () => {
    fakeCounter();
    // 60 sinh viên, mỗi người preview + join (2 request) từ cùng 1 IP
    for (let s = 0; s < 60; s += 1) {
      for (let r = 0; r < 2; r += 1) {
        await expect(enforceRateLimit('classJoin', `user:s${s}`, ['classJoinIp', 'ip:10.0.0.1'])).resolves.toBeNull();
      }
    }
  });
});

describe('cleanupRateLimits', () => {
  it('deletes windows older than the cutoff', async () => {
    db.rateLimit.deleteMany.mockResolvedValue({ count: 3 });
    const now = new Date(WINDOW_START);

    await expect(cleanupRateLimits(24, now)).resolves.toBe(3);
    expect(db.rateLimit.deleteMany).toHaveBeenCalledWith({
      where: { windowStart: { lt: new Date(WINDOW_START - 24 * 3600 * 1000) } },
    });
  });
});
