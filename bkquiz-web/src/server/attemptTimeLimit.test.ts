import { describe, expect, it, vi } from 'vitest';
import {
  calculateAttemptEndTime,
  calculateSessionEndTime,
  DEFAULT_BUFFER_MINUTES,
  getEffectiveDurationSeconds,
} from './attemptTimeLimit';

// Chỉ test hàm thuần; module có import prisma cho validateAttemptTimeLimit
vi.mock('@/server/prisma', () => ({ prisma: {} }));

const START = new Date('2026-11-26T08:00:00.000Z');
const plus = (base: Date, minutes: number) => new Date(base.getTime() + minutes * 60 * 1000);

describe('getEffectiveDurationSeconds', () => {
  it('null when the session has no time limit', () => {
    expect(getEffectiveDurationSeconds(null)).toBeNull();
    expect(getEffectiveDurationSeconds({})).toBeNull();
    expect(getEffectiveDurationSeconds({ durationSeconds: 0 })).toBeNull();
  });

  it('duration plus teacher extensions', () => {
    expect(getEffectiveDurationSeconds({ durationSeconds: 1800 })).toBe(1800);
    expect(getEffectiveDurationSeconds({ durationSeconds: 1800, extensionSeconds: 600 })).toBe(2400);
  });
});

describe('calculateSessionEndTime', () => {
  it('start + duration + default buffer (5 min)', () => {
    expect(DEFAULT_BUFFER_MINUTES).toBe(5);
    expect(calculateSessionEndTime(START, { durationSeconds: 1800 })).toEqual(plus(START, 35));
  });

  it('uses the configured buffer and adds extensions', () => {
    expect(calculateSessionEndTime(START, { durationSeconds: 1800, bufferMinutes: 10, extensionSeconds: 300 }))
      .toEqual(plus(START, 45));
  });

  it('null without time limit', () => {
    expect(calculateSessionEndTime(START, null)).toBeNull();
  });
});

describe('calculateAttemptEndTime', () => {
  const session = (settings: unknown, startedAt: Date | null = START) => ({ startedAt, settings });

  it('null before the student starts or before the session starts', () => {
    expect(calculateAttemptEndTime({ attemptStartedAt: null, quizSession: session({ durationSeconds: 1800 }) })).toBeNull();
    expect(calculateAttemptEndTime({ attemptStartedAt: START, quizSession: session({ durationSeconds: 1800 }, null) })).toBeNull();
  });

  it('null without time limit', () => {
    expect(calculateAttemptEndTime({ attemptStartedAt: START, quizSession: session({}) })).toBeNull();
  });

  it('student who starts on time gets the full duration', () => {
    expect(calculateAttemptEndTime({ attemptStartedAt: START, quizSession: session({ durationSeconds: 1800 }) }))
      .toEqual(plus(START, 30));
  });

  it('late student is cut off by the session end (start + duration + buffer)', () => {
    const late = plus(START, 20);

    expect(calculateAttemptEndTime({ attemptStartedAt: late, quizSession: session({ durationSeconds: 1800 }) }))
      .toEqual(plus(START, 35));
  });

  it('student starting slightly late keeps the full duration while within the buffer', () => {
    const late = plus(START, 3);

    expect(calculateAttemptEndTime({ attemptStartedAt: late, quizSession: session({ durationSeconds: 1800 }) }))
      .toEqual(plus(START, 33));
  });

  it('per-attempt extra time only moves that attempt, also past the common session end', () => {
    const settings = { durationSeconds: 1800 };

    // Vào đúng giờ: 30 phút + 10 phút riêng
    expect(calculateAttemptEndTime({ attemptStartedAt: START, extraSeconds: 600, quizSession: session(settings) }))
      .toEqual(plus(START, 40));
    // Vào muộn 20 phút: mốc chung 35 phút, cộng 10 phút riêng → 45 phút
    expect(calculateAttemptEndTime({ attemptStartedAt: plus(START, 20), extraSeconds: 600, quizSession: session(settings) }))
      .toEqual(plus(START, 45));
    // Không có / bằng 0 / âm → như cũ
    expect(calculateAttemptEndTime({ attemptStartedAt: START, extraSeconds: null, quizSession: session(settings) }))
      .toEqual(plus(START, 30));
    expect(calculateAttemptEndTime({ attemptStartedAt: START, extraSeconds: -300, quizSession: session(settings) }))
      .toEqual(plus(START, 30));
  });

  it('teacher extension moves both the attempt and the session end', () => {
    const settings = { durationSeconds: 1800, extensionSeconds: 600 };

    expect(calculateAttemptEndTime({ attemptStartedAt: START, quizSession: session(settings) })).toEqual(plus(START, 40));
    expect(calculateAttemptEndTime({ attemptStartedAt: plus(START, 20), quizSession: session(settings) }))
      .toEqual(plus(START, 45));
  });
});
