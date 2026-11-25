import { describe, expect, it } from 'vitest';
import {
  applyFailedVerify,
  CHECKPOINT_MAX_SECONDS,
  CHECKPOINT_MIN_SECONDS,
  COOLDOWN_SECONDS,
  getCheckpointPhase,
  GRACE_SECONDS_BEFORE_BLOCK,
  isAttemptLocked,
  isInCooldown,
  LOCK_SECONDS,
  nextCheckpointDueAt,
  randomInt,
} from './checkpointPolicy';

const NOW = new Date('2026-11-26T08:00:00.000Z');
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

describe('applyFailedVerify', () => {
  it('1st and 2nd wrong token: no cooldown, no lock', () => {
    expect(applyFailedVerify(0, NOW)).toEqual({ failedCount: 1, cooldownUntil: null, lockedUntil: null, locked: false });
    expect(applyFailedVerify(1, NOW)).toMatchObject({ failedCount: 2, cooldownUntil: null, locked: false });
  });

  it.each([2, 3, 4])('wrong token #%i+1 → 30 s cooldown, not locked', (previous) => {
    const r = applyFailedVerify(previous, NOW);

    expect(r.cooldownUntil).toEqual(at(COOLDOWN_SECONDS));
    expect(r.lockedUntil).toBeNull();
    expect(r.locked).toBe(false);
  });

  it('6th wrong token → locked for 5 minutes (and still in cooldown)', () => {
    const r = applyFailedVerify(5, NOW);

    expect(r.failedCount).toBe(6);
    expect(r.lockedUntil).toEqual(at(LOCK_SECONDS));
    expect(LOCK_SECONDS).toBe(300);
    expect(r.cooldownUntil).toEqual(at(COOLDOWN_SECONDS));
    expect(r.locked).toBe(true);
  });

  it('keeps locking after the 6th failure', () => {
    expect(applyFailedVerify(9, NOW).locked).toBe(true);
  });
});

describe('isInCooldown / isAttemptLocked', () => {
  it('cooldown only while cooldownUntil is in the future', () => {
    expect(isInCooldown(null, NOW)).toBe(false);
    expect(isInCooldown(at(1), NOW)).toBe(true);
    expect(isInCooldown(NOW, NOW)).toBe(false);
  });

  it('lockedUntil decides when present, otherwise the status', () => {
    expect(isAttemptLocked(at(60), 'active', NOW)).toBe(true);
    expect(isAttemptLocked(at(-1), 'locked', NOW)).toBe(false); // hết hạn khoá
    expect(isAttemptLocked(null, 'locked', NOW)).toBe(true);
    expect(isAttemptLocked(null, 'active', NOW)).toBe(false);
  });
});

describe('nextCheckpointDueAt', () => {
  it('lowest random value → 240 s, highest → 300 s', () => {
    expect(nextCheckpointDueAt(NOW, () => 0)).toEqual(at(CHECKPOINT_MIN_SECONDS));
    expect(nextCheckpointDueAt(NOW, () => 0.999999)).toEqual(at(CHECKPOINT_MAX_SECONDS));
  });

  it('always lands within [240, 300] s with Math.random', () => {
    for (let i = 0; i < 500; i += 1) {
      const seconds = (nextCheckpointDueAt(NOW).getTime() - NOW.getTime()) / 1000;

      expect(Number.isInteger(seconds)).toBe(true);
      expect(seconds).toBeGreaterThanOrEqual(240);
      expect(seconds).toBeLessThanOrEqual(300);
    }
  });

  it('randomInt is inclusive on both ends', () => {
    expect(randomInt(1, 3, () => 0)).toBe(1);
    expect(randomInt(1, 3, () => 0.99)).toBe(3);
  });
});

describe('getCheckpointPhase', () => {
  const due = NOW;

  it('no checkpoint scheduled → neither warning nor due', () => {
    expect(getCheckpointPhase(null, NOW)).toEqual({ warning: false, due: false });
  });

  it('before the checkpoint → ok', () => {
    expect(getCheckpointPhase(due, at(-1))).toEqual({ warning: false, due: false });
  });

  it('within the grace period → warning', () => {
    expect(getCheckpointPhase(due, NOW)).toEqual({ warning: true, due: false });
    expect(getCheckpointPhase(due, at(GRACE_SECONDS_BEFORE_BLOCK - 0.001))).toEqual({ warning: true, due: false });
  });

  it('grace period over → due (student is blocked)', () => {
    expect(getCheckpointPhase(due, at(GRACE_SECONDS_BEFORE_BLOCK))).toEqual({ warning: false, due: true });
    expect(getCheckpointPhase(due, at(120))).toEqual({ warning: false, due: true });
  });
});
