import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeTotp, generateTotpSecret, verifyTotp } from './totp';

const STEP = 45;
const SECRET = 'JBSWY3DPEHPK3PXP';
// 1_800_000_000_000 chia hết cho 45 000 → đúng đầu một bước TOTP
const STEP_START = 1_800_000_000_000;

function tokenAt(ms: number) {
  vi.setSystemTime(ms);
  return computeTotp({ secret: SECRET, stepSeconds: STEP, nowMs: ms }).token;
}

function verifyAt(ms: number, token: string, window?: number) {
  vi.setSystemTime(ms);
  return verifyTotp({ secret: SECRET, stepSeconds: STEP, token, window });
}

describe('TOTP (45 s step)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates a 6-digit token', () => {
    expect(tokenAt(STEP_START)).toMatch(/^\d{6}$/);
  });

  it('the same token is valid during its whole step', () => {
    const token = tokenAt(STEP_START);

    expect(tokenAt(STEP_START + 44_999)).toBe(token);
    expect(verifyAt(STEP_START + 30_000, token)).toBe(true);
  });

  it('the token changes in the next step', () => {
    expect(tokenAt(STEP_START + STEP * 1000)).not.toBe(tokenAt(STEP_START));
  });

  it('accepts a token from the previous or next step (window ±1, clock drift)', () => {
    const token = tokenAt(STEP_START);

    expect(verifyAt(STEP_START + STEP * 1000, token)).toBe(true); // nhập trễ 1 bước
    expect(verifyAt(STEP_START - STEP * 1000, token)).toBe(true); // đồng hồ máy chủ chậm 1 bước
  });

  it('rejects a token 2 steps away', () => {
    const token = tokenAt(STEP_START);

    expect(verifyAt(STEP_START + 2 * STEP * 1000, token)).toBe(false);
    expect(verifyAt(STEP_START - 2 * STEP * 1000, token)).toBe(false);
  });

  it('window 0 only accepts the current step', () => {
    const token = tokenAt(STEP_START);

    expect(verifyAt(STEP_START + 10_000, token, 0)).toBe(true);
    expect(verifyAt(STEP_START + STEP * 1000, token, 0)).toBe(false);
  });

  it('rejects a token made with another secret', () => {
    vi.setSystemTime(STEP_START);
    const other = computeTotp({ secret: generateTotpSecret(), stepSeconds: STEP, nowMs: STEP_START }).token;
    const own = tokenAt(STEP_START);

    // Xác suất 2 secret ra cùng token là 1/10^6; bỏ qua trường hợp trùng hiếm hoi đó
    if (other !== own) {
      expect(verifyAt(STEP_START, other)).toBe(false);
    }
  });

  it('rejects malformed tokens', () => {
    expect(verifyAt(STEP_START, 'abcdef')).toBe(false);
    expect(verifyAt(STEP_START, '')).toBe(false);
  });

  it.each([
    [0, 45],
    [20_000, 25],
    [44_500, 1],
  ])('expiresInSeconds at +%i ms in the step = %i', (offset, expected) => {
    vi.setSystemTime(STEP_START + offset);

    expect(computeTotp({ secret: SECRET, stepSeconds: STEP, nowMs: STEP_START + offset }).expiresInSeconds).toBe(expected);
  });
});
