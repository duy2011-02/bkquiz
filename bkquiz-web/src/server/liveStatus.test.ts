import type { LiveStatusInput } from './liveStatus';
import { describe, expect, it } from 'vitest';
import { canUnlock, deriveLiveStatus, LIVE_STATUS_ORDER, OFFLINE_AFTER_SECONDS } from './liveStatus';

const NOW = new Date('2026-11-26T08:30:00.000Z');
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

function attempt(over: Partial<LiveStatusInput> = {}): LiveStatusInput {
  return {
    status: 'active',
    attemptStartedAt: at(-600),
    lockedUntil: null,
    cooldownUntil: null,
    nextDueAt: at(120),
    lastSeenAt: at(-2),
    attemptEndTime: at(900),
    ...over,
  };
}

describe('deriveLiveStatus', () => {
  it('working while seen recently, before the checkpoint', () => {
    expect(deriveLiveStatus(attempt(), 'active', NOW)).toBe('working');
  });

  it('submitted wins over everything', () => {
    expect(deriveLiveStatus(attempt({ status: 'submitted', lastSeenAt: at(-3600) }), 'ended', NOW)).toBe('submitted');
  });

  it('session ended and not submitted → time_up', () => {
    expect(deriveLiveStatus(attempt(), 'ended', NOW)).toBe('time_up');
  });

  it('lobby or not started yet → not_started', () => {
    expect(deriveLiveStatus(attempt({ attemptStartedAt: null }), 'active', NOW)).toBe('not_started');
    expect(deriveLiveStatus(attempt({ attemptStartedAt: null }), 'lobby', NOW)).toBe('not_started');
  });

  it('locked (lockedUntil in the future or status locked) has priority over offline', () => {
    expect(deriveLiveStatus(attempt({ lockedUntil: at(200), lastSeenAt: at(-300) }), 'active', NOW)).toBe('locked');
    expect(deriveLiveStatus(attempt({ status: 'locked' }), 'active', NOW)).toBe('locked');
  });

  it('expired lock is no longer locked', () => {
    expect(deriveLiveStatus(attempt({ status: 'locked', lockedUntil: at(-1) }), 'active', NOW)).toBe('working');
  });

  it('time_up when the attempt end time has passed', () => {
    expect(deriveLiveStatus(attempt({ attemptEndTime: at(-1) }), 'active', NOW)).toBe('time_up');
    expect(deriveLiveStatus(attempt({ attemptEndTime: null }), 'active', NOW)).toBe('working');
  });

  it(`offline after ${OFFLINE_AFTER_SECONDS}s without a heartbeat`, () => {
    expect(deriveLiveStatus(attempt({ lastSeenAt: at(-OFFLINE_AFTER_SECONDS) }), 'active', NOW)).toBe('working');
    expect(deriveLiveStatus(attempt({ lastSeenAt: at(-OFFLINE_AFTER_SECONDS - 1) }), 'active', NOW)).toBe('offline');
  });

  it('falls back to attemptStartedAt when lastSeenAt was never written', () => {
    expect(deriveLiveStatus(attempt({ lastSeenAt: null, attemptStartedAt: at(-5) }), 'active', NOW)).toBe('working');
    expect(deriveLiveStatus(attempt({ lastSeenAt: null }), 'active', NOW)).toBe('offline');
  });

  it('cooldown after several wrong tokens', () => {
    expect(deriveLiveStatus(attempt({ cooldownUntil: at(20) }), 'active', NOW)).toBe('cooldown');
  });

  it('checkpoint_due from the checkpoint time (warning and blocked phases)', () => {
    expect(deriveLiveStatus(attempt({ nextDueAt: at(-1) }), 'active', NOW)).toBe('checkpoint_due');
    expect(deriveLiveStatus(attempt({ nextDueAt: at(-60) }), 'active', NOW)).toBe('checkpoint_due');
  });

  it('every status has a display position', () => {
    expect(new Set(LIVE_STATUS_ORDER).size).toBe(9);
  });
});

describe('canUnlock', () => {
  it('locked or in cooldown → can unlock', () => {
    expect(canUnlock({ status: 'locked', lockedUntil: null, cooldownUntil: null }, NOW)).toBe(true);
    expect(canUnlock({ status: 'active', lockedUntil: at(10), cooldownUntil: null }, NOW)).toBe(true);
    expect(canUnlock({ status: 'active', lockedUntil: null, cooldownUntil: at(10) }, NOW)).toBe(true);
  });

  it('normal or submitted attempts cannot be unlocked', () => {
    expect(canUnlock({ status: 'active', lockedUntil: null, cooldownUntil: null }, NOW)).toBe(false);
    expect(canUnlock({ status: 'submitted', lockedUntil: at(10), cooldownUntil: null }, NOW)).toBe(false);
  });

  it('status locked with an expired lockedUntil can still be cleared', () => {
    expect(canUnlock({ status: 'locked', lockedUntil: at(-1), cooldownUntil: null }, NOW)).toBe(true);
  });
});
