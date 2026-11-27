import type { QuizCopySource } from './quizCopy';
import { describe, expect, it } from 'vitest';
import { buildQuizCopy, QUIZ_TITLE_MAX } from './quizCopy';

const source: QuizCopySource = {
  title: 'Giữa kỳ',
  settings: { durationSeconds: 900, scoring: { mode: 'partial', partialCreditMethod: 'halves' } },
  rules: [
    { tagId: 't1', count: 10, commonCount: 8, variantCount: 2, extraPercent: 20, filters: { poolIds: ['p1'] } },
    { tagId: 't2', count: null, commonCount: null, variantCount: null, extraPercent: null, filters: {} },
  ],
  tags: [{ tagId: 'a' }, { tagId: 'b' }, { tagId: 'a' }],
};

describe('buildQuizCopy', () => {
  it('copies settings, rules and tags into a new draft owned by the caller', () => {
    const data = buildQuizCopy(source, 'teacher-2', 'Giữa kỳ (bản sao)');

    expect(data.title).toBe('Giữa kỳ (bản sao)');
    expect(data.status).toBe('draft');
    expect(data.settings).toEqual(source.settings);
    expect(data.createdBy).toEqual({ connect: { id: 'teacher-2' } });
    expect(data.rules).toEqual({
      create: [
        { tag: { connect: { id: 't1' } }, count: 10, commonCount: 8, variantCount: 2, extraPercent: 20, filters: { poolIds: ['p1'] } },
        { tag: { connect: { id: 't2' } }, count: null, commonCount: null, variantCount: null, extraPercent: null, filters: {} },
      ],
    });
    expect(data.tags).toEqual({ create: [{ tag: { connect: { id: 'a' } } }, { tag: { connect: { id: 'b' } } }] });
  });

  it('defaults the title and keeps it within the limit', () => {
    expect(buildQuizCopy(source, 'u').title).toBe('Giữa kỳ (copy)');
    expect(buildQuizCopy(source, 'u', '   ').title).toBe('Giữa kỳ (copy)');
    expect(buildQuizCopy(source, 'u', 'x'.repeat(300)).title).toHaveLength(QUIZ_TITLE_MAX);
  });

  it('null settings become an empty object', () => {
    const data = buildQuizCopy({ ...source, settings: null }, 'u');

    expect(data.settings).toEqual({});
  });
});
