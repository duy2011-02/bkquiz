import type { StatsAttempt, StatsQuestion } from './questionStats';
import { describe, expect, it } from 'vitest';
import { computeQuestionStats } from './questionStats';

/** Câu 4 phương án, đáp án đúng theo `correct` */
function q(id: string, order: number, correct: number[], type: StatsQuestion['type'] = 'mcq_single'): StatsQuestion {
  return {
    id,
    order,
    type,
    prompt: `Câu ${order + 1}`,
    options: [0, 1, 2, 3].map(o => ({ order: o, content: String.fromCharCode(65 + o), isCorrect: correct.includes(o) })),
  };
}

/** Bài làm: answers theo câu, điểm câu = 1 nếu chọn đúng chính xác (như all_or_nothing) */
function att(id: string, questions: StatsQuestion[], answers: Record<string, number[]>, assigned: string[] = []): StatsAttempt {
  const questionScores: Record<string, number> = {};
  const list = assigned.length ? questions.filter(x => assigned.includes(x.id)) : questions;
  for (const x of list) {
    const correct = x.options.filter(o => o.isCorrect).map(o => o.order);
    const sel = [...(answers[x.id] ?? [])].sort();
    questionScores[x.id] = sel.length === correct.length && sel.every((v, i) => v === correct[i]) ? 1 : 0;
  }
  return { id, score: Object.values(questionScores).reduce((s, v) => s + v, 0), questionScores, assigned, answers };
}

const Q = [q('q1', 0, [1]), q('q2', 1, [0, 2], 'mcq_multi')];

describe('computeQuestionStats', () => {
  it('no submissions → empty summary, zero histogram, null rates', () => {
    const r = computeQuestionStats({ questions: Q, attempts: [] });

    expect(r.summary).toEqual({ submitted: 0, meanPercent: null, medianPercent: null, minPercent: null, maxPercent: null });
    expect(r.histogram.every(b => b.count === 0)).toBe(true);
    expect(r.questions[0]).toMatchObject({ n: 0, correctRate: null, discrimination: null, topDistractor: null, labels: [] });
  });

  it('counts option choices, correct and unanswered rates', () => {
    const attempts = [
      att('a1', Q, { q1: [1], q2: [0, 2] }),
      att('a2', Q, { q1: [3], q2: [0] }),
      att('a3', Q, { q1: [3] }),
      att('a4', Q, { q2: [2, 0] }),
    ];
    const r = computeQuestionStats({ questions: Q, attempts });
    const [s1, s2] = r.questions;

    expect(s1).toMatchObject({ n: 4, correctRate: 0.25, unansweredRate: 0.25, avgScore: 0.25, topDistractor: 3 });
    expect(s1!.options.map(o => o.count)).toEqual([0, 1, 0, 2]);
    expect(s1!.options[3]!.rate).toBe(0.5);
    expect(s2).toMatchObject({ n: 4, correctRate: 0.5, unansweredRate: 0.25, topDistractor: null });
    expect(s2!.options.map(o => o.count)).toEqual([3, 0, 2, 0]);
  });

  it('summary in percent, histogram bins (100% goes in the last bin)', () => {
    const attempts = [
      att('a1', Q, { q1: [1], q2: [0, 2] }), // 100%
      att('a2', Q, { q1: [1] }), // 50%
      att('a3', Q, {}), // 0%
    ];
    const r = computeQuestionStats({ questions: Q, attempts });

    expect(r.summary).toEqual({ submitted: 3, meanPercent: 50, medianPercent: 50, minPercent: 0, maxPercent: 100 });
    expect(r.histogram[0]!.count).toBe(1);
    expect(r.histogram[5]!.count).toBe(1);
    expect(r.histogram[9]!.count).toBe(1);
  });

  it('variant exam: a question only counts the attempts it was assigned to', () => {
    const attempts = [
      att('a1', Q, { q1: [1] }, ['q1']),
      att('a2', Q, { q1: [0], q2: [0, 2] }, ['q1', 'q2']),
    ];
    const r = computeQuestionStats({ questions: Q, attempts });

    expect(r.questions[0]!.n).toBe(2);
    expect(r.questions[1]!.n).toBe(1);
    // a1: 1/1 = 100%, a2: 1/2 = 50%
    expect(r.summary.meanPercent).toBe(75);
  });

  it('discrimination is null below 10 submissions', () => {
    const attempts = Array.from({ length: 9 }, (_, i) => att(`a${i}`, Q, { q1: [1] }));

    expect(computeQuestionStats({ questions: Q, attempts }).questions[0]!.discrimination).toBeNull();
  });

  it('discrimination = top 27% mean − bottom 27% mean; low or negative → review', () => {
    // 10 bài: 3 bài nhóm cao đúng cả 2 câu, 3 bài nhóm thấp sai cả 2 → độ phân biệt tối đa
    const good = (id: string) => att(id, Q, { q1: [1], q2: [0, 2] });
    const bad = (id: string) => att(id, Q, { q1: [0], q2: [1] });
    const mid = (id: string) => att(id, Q, { q1: [1] });
    const attempts = [good('g1'), good('g2'), good('g3'), mid('m1'), mid('m2'), mid('m3'), mid('m4'), bad('b1'), bad('b2'), bad('b3')];
    const r = computeQuestionStats({ questions: Q, attempts });

    // k = round(10 × 0.27) = 3 → top = g*, bottom = b*
    expect(r.questions[0]!.discrimination).toBe(1);
    expect(r.questions[1]!.discrimination).toBe(1);

    // Câu chỉ nhóm giữa làm đúng, cả nhóm cao lẫn nhóm thấp đều sai → độ phân biệt 0 → cần xem lại
    const Q2 = [q('q1', 0, [1]), q('q2', 1, [3]), q('q3', 2, [2])];
    const strong = (id: string) => att(id, Q2, { q1: [1], q2: [0], q3: [2] }); // 2/3
    const weak = (id: string) => att(id, Q2, { q1: [0], q2: [3], q3: [0] }); // 1/3
    const none = (id: string) => att(id, Q2, {}); // 0
    const all = [strong('s1'), strong('s2'), strong('s3'), none('n1'), none('n2'), none('n3'), none('n4'), weak('w1'), weak('w2'), weak('w3')];
    // xếp hạng: s (66%) > w (33%) > n (0%) → nhóm thấp là n*, không làm q2 → 0; nhóm cao s* làm sai q2 → 0
    const r2 = computeQuestionStats({ questions: Q2, attempts: all });

    expect(r2.questions[1]!.discrimination).toBe(0);
    expect(r2.questions[1]!.labels).toContain('review');
  });

  it('labels hard (< 30% correct) and easy (> 85% correct)', () => {
    const attempts = Array.from({ length: 7 }, (_, i) => att(`a${i}`, Q, { q1: [1], q2: i === 0 ? [0, 2] : [0] }));
    const r = computeQuestionStats({ questions: Q, attempts });

    expect(r.questions[0]!.labels).toEqual(['easy']);
    expect(r.questions[1]!.labels).toEqual(['hard']);
  });

  it('partial scoring: avgScore uses the stored question scores, correctRate stays exact-match', () => {
    const a: StatsAttempt = { id: 'a1', score: 0.75, questionScores: { q1: 0, q2: 0.75 }, assigned: [], answers: { q2: [0] } };
    const r = computeQuestionStats({ questions: Q, attempts: [a] });

    expect(r.questions[1]).toMatchObject({ avgScore: 0.75, correctRate: 0 });
  });
});
