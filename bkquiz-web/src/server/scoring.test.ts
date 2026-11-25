import type { ResolvedScoring, ScorableOption } from './scoring';
import { describe, expect, it } from 'vitest';
import {
  computeAllOrNothing,
  computeByHalves,
  computeEDC,
  computePenalty,
  normalizeSelected,
  resolveScoringSettings,
  roundScore,
  scoreAttempt,
  scoreQuestion,
} from './scoring';

const ALL_OR_NOTHING = resolveScoringSettings({ mode: 'all_or_nothing' });
const EDC = resolveScoringSettings({ mode: 'partial', partialCreditMethod: 'edc' });
const HALVES = resolveScoringSettings({ mode: 'partial', partialCreditMethod: 'halves' });
const PENALTY = resolveScoringSettings({ mode: 'penalty' });

/** 4 phương án A-D, đáp án đúng theo danh sách `correct`. */
function opts(correct: number[], count = 4): ScorableOption[] {
  return Array.from({ length: count }, (_, order) => ({ order, isCorrect: correct.includes(order) }));
}

function score(options: ScorableOption[], selected: unknown, scoring: ResolvedScoring) {
  return scoreQuestion(options, selected, scoring).score;
}

describe('resolveScoringSettings', () => {
  it('uses defaults when quiz has no scoring settings', () => {
    expect(resolveScoringSettings(undefined)).toEqual({
      mode: 'all_or_nothing',
      partialMethod: 'edc',
      penaltyPerWrongOption: 0.25,
      rounding: 'round_2',
    });
  });

  it('keeps provided values', () => {
    expect(resolveScoringSettings({ mode: 'penalty', penaltyPerWrongOption: 0.5, rounding: 'none' })).toMatchObject({
      mode: 'penalty',
      penaltyPerWrongOption: 0.5,
      rounding: 'none',
    });
  });
});

describe('normalizeSelected', () => {
  it('drops non-integers and duplicates, sorts ascending', () => {
    expect(normalizeSelected([2, 0, 2, 1.5, '1', null, 3])).toEqual([0, 2, 3]);
  });

  it('treats non-arrays as empty', () => {
    expect(normalizeSelected(undefined)).toEqual([]);
    expect(normalizeSelected({ 0: 1 })).toEqual([]);
  });
});

describe('roundScore', () => {
  it('rounds to 2 decimals with round_2', () => {
    expect(roundScore(2 / 3, 'round_2')).toBe(0.67);
  });

  it('keeps raw value with none', () => {
    expect(roundScore(2 / 3, 'none')).toBe(2 / 3);
  });
});

describe('all_or_nothing', () => {
  it('single choice: correct = 1, wrong = 0, empty = 0', () => {
    const o = opts([2]);

    expect(score(o, [2], ALL_OR_NOTHING)).toBe(1);
    expect(score(o, [1], ALL_OR_NOTHING)).toBe(0);
    expect(score(o, [], ALL_OR_NOTHING)).toBe(0);
  });

  it('multi choice: only the exact correct set scores', () => {
    const o = opts([0, 2]);

    expect(score(o, [2, 0], ALL_OR_NOTHING)).toBe(1);
    expect(score(o, [0], ALL_OR_NOTHING)).toBe(0); // thiếu
    expect(score(o, [0, 1, 2], ALL_OR_NOTHING)).toBe(0); // thừa
  });

  it('computeAllOrNothing compares sorted arrays', () => {
    expect(computeAllOrNothing([0, 2], [0, 2])).toBe(1);
    expect(computeAllOrNothing([0], [0, 2])).toBe(0);
  });
});

describe('partial – Every Decision Counts', () => {
  it('scores the share of correct decisions', () => {
    const o = opts([0, 2]); // A, C đúng

    expect(score(o, [0, 2], EDC)).toBe(1);
    expect(score(o, [0], EDC)).toBe(0.75); // bỏ sót C
    expect(score(o, [0, 1, 2], EDC)).toBe(0.75); // chọn thừa B
    expect(score(o, [], EDC)).toBe(0.5); // không chọn B, D vẫn là 2 quyết định đúng
    expect(score(o, [1, 3], EDC)).toBe(0);
  });

  it('returns 0 when the question has no options', () => {
    expect(computeEDC([], new Set(), 0)).toBe(0);
  });
});

describe('partial – by halves', () => {
  const o = opts([0, 2]);

  it.each([
    [[0, 2], 1], // 0 lỗi
    [[0], 0.5], // 1 lỗi
    [[0, 1], 0.25], // 2 lỗi
    [[1, 3], 0], // 4 lỗi
    [[0, 1, 3], 0], // 3 lỗi
  ])('selected %j → %d', (selected, expected) => {
    expect(score(o, selected, HALVES)).toBe(expected);
  });

  it('computeByHalves counts both wrong picks and missed answers', () => {
    expect(computeByHalves([1], new Set([0]), 4)).toBe(0.25);
  });
});

describe('penalty', () => {
  const o = opts([0, 2]);

  it('1 point when at least one correct option is chosen, missing ones are not penalised', () => {
    expect(score(o, [0], PENALTY)).toBe(1);
    expect(score(o, [0, 2], PENALTY)).toBe(1);
  });

  it('subtracts penaltyPerWrongOption for each wrong pick', () => {
    expect(score(o, [0, 1], PENALTY)).toBe(0.75);
    expect(score(o, [0, 1, 3], PENALTY)).toBe(0.5);
  });

  it('never goes below 0', () => {
    expect(score(o, [1, 3], PENALTY)).toBe(0);
    expect(computePenalty([0, 1, 3], new Set([0]), 4, 0.6)).toBe(0);
  });

  it('respects a custom penalty', () => {
    const custom = resolveScoringSettings({ mode: 'penalty', penaltyPerWrongOption: 0.5 });

    expect(score(o, [0, 1], custom)).toBe(0.5);
  });

  it('ignores out-of-range option orders', () => {
    expect(computePenalty([0, 9, -1], new Set([0]), 4, 0.25)).toBe(1);
  });
});

describe('scoreQuestion', () => {
  it('reports isFullyCorrect independently of the scoring mode', () => {
    const o = opts([0, 2]);

    expect(scoreQuestion(o, [0], EDC)).toEqual({ score: 0.75, isFullyCorrect: false });
    expect(scoreQuestion(o, [2, 0], PENALTY)).toEqual({ score: 1, isFullyCorrect: true });
  });

  it('treats an unanswered question (undefined) as empty', () => {
    expect(scoreQuestion(opts([1]), undefined, ALL_OR_NOTHING)).toEqual({ score: 0, isFullyCorrect: false });
  });
});

describe('scoreAttempt', () => {
  const questions = [
    { id: 'q1', options: opts([0]) },
    { id: 'q2', options: opts([0, 2]) },
    { id: 'q3', options: opts([3]) },
  ];

  it('sums per-question scores and counts fully correct answers', () => {
    const answers = new Map<string, unknown>([
      ['q1', [0]],
      ['q2', [0]],
      // q3 bỏ trống
    ]);
    const r = scoreAttempt({ questions, answers, scoring: EDC });

    expect(r.questionScores).toEqual({ q1: 1, q2: 0.75, q3: 0.75 });
    expect(r.score).toBe(2.5);
    expect(r.correctCount).toBe(1);
    expect(r.totalQuestions).toBe(3);
  });

  it('rounds the total once, from unrounded question scores', () => {
    // 3 phương án → EDC cho 2/3 mỗi câu; tổng 3 câu = 2 (không phải 0.67 * 3 = 2.01)
    const three = ['a', 'b', 'c'].map(id => ({ id, options: opts([0], 3) }));
    const answers = new Map<string, unknown>(three.map(q => [q.id, [0, 1]]));
    const r = scoreAttempt({ questions: three, answers, scoring: EDC });

    expect(r.questionScores.a).toBe(0.67);
    expect(r.score).toBe(2);
  });

  it('variant exam: only the assigned questions are scored', () => {
    // Sinh viên chỉ được giao q1 và q3; đáp án của q2 (nếu có) không được tính
    const assigned = [questions[0]!, questions[2]!];
    const answers = new Map<string, unknown>([['q1', [0]], ['q2', [0, 2]], ['q3', [3]]]);
    const r = scoreAttempt({ questions: assigned, answers, scoring: ALL_OR_NOTHING });

    expect(Object.keys(r.questionScores)).toEqual(['q1', 'q3']);
    expect(r.score).toBe(2);
    expect(r.totalQuestions).toBe(2);
  });

  it('returns zeros for an attempt without questions', () => {
    expect(scoreAttempt({ questions: [], answers: new Map(), scoring: PENALTY })).toEqual({
      score: 0,
      correctCount: 0,
      totalQuestions: 0,
      questionScores: {},
    });
  });
});
