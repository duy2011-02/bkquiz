import type { ScorableOption } from '@/server/scoring';
import { normalizeSelected, scoreQuestion } from '@/server/scoring';

/**
 * Thống kê câu hỏi sau một phiên thi — hàm thuần, có unit test ở `questionStats.test.ts`.
 * Chỉ tính bài đã nộp (kể cả bài giáo viên thu). Đề biến thể: mỗi câu chỉ tính trên các bài được giao câu đó.
 */

export type StatsQuestion = {
  id: string;
  order: number;
  type: 'mcq_single' | 'mcq_multi';
  prompt: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  options: Array<ScorableOption & { content: string }>;
};

export type StatsAttempt = {
  id: string;
  /** Tổng điểm (mỗi câu tối đa 1) */
  score: number;
  /** Điểm từng câu đã chấm khi nộp (`Attempt.questionScores`) */
  questionScores: Record<string, number>;
  /** Câu được giao (đề biến thể); rỗng → toàn bộ câu của phiên */
  assigned: string[];
  /** sessionQuestionId → `Answer.selected` */
  answers: Record<string, unknown>;
};

export type QuestionLabel = 'hard' | 'easy' | 'review';

export type QuestionStat = {
  id: string;
  order: number;
  type: StatsQuestion['type'];
  prompt: string;
  imageUrl: string | null;
  imageAlt: string | null;
  /** Số bài đã nộp được giao câu này */
  n: number;
  /** Điểm trung bình của câu (0..1) */
  avgScore: number | null;
  /** Tỉ lệ chọn đúng chính xác tập đáp án đúng (0..1) */
  correctRate: number | null;
  unansweredRate: number | null;
  /** Độ phân biệt: điểm TB nhóm 27% điểm cao − nhóm 27% điểm thấp (−1..1); null khi < MIN_FOR_DISCRIMINATION bài */
  discrimination: number | null;
  options: Array<{ order: number; content: string; isCorrect: boolean; count: number; rate: number | null }>;
  /** Phương án sai được chọn nhiều nhất (nhiễu hiệu quả nhất), nếu có người chọn */
  topDistractor: number | null;
  labels: QuestionLabel[];
};

export type SessionStats = {
  summary: {
    submitted: number;
    /** Điểm theo % (điểm / số câu được giao × 100) để so sánh được khi đề biến thể */
    meanPercent: number | null;
    medianPercent: number | null;
    minPercent: number | null;
    maxPercent: number | null;
  };
  /** 10 khoảng theo %: [0,10), [10,20) … [90,100] */
  histogram: Array<{ from: number; to: number; count: number }>;
  questions: QuestionStat[];
};

export const GROUP_FRACTION = 0.27;
export const MIN_FOR_DISCRIMINATION = 10;
export const LABEL_THRESHOLDS = {
  hardBelow: 0.3,
  easyAbove: 0.85,
  reviewDiscriminationBelow: 0.2,
} as const;

const round = (x: number, digits = 3) => Math.round(x * 10 ** digits) / 10 ** digits;

function median(sorted: number[]): number | null {
  if (sorted.length === 0) {
    return null;
  }
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function computeQuestionStats(input: { questions: StatsQuestion[]; attempts: StatsAttempt[] }): SessionStats {
  const allIds = input.questions.map(q => q.id);
  const assignedOf = (a: StatsAttempt) => new Set(a.assigned.length > 0 ? a.assigned : allIds);

  // % điểm từng bài
  const percents = new Map<string, number>();
  for (const a of input.attempts) {
    const count = assignedOf(a).size;
    percents.set(a.id, count > 0 ? (a.score / count) * 100 : 0);
  }
  const sortedPercents = [...percents.values()].sort((x, y) => x - y);

  // Nhóm cao / thấp cho độ phân biệt (theo % điểm cả bài)
  const ranked = [...input.attempts].sort((x, y) => percents.get(y.id)! - percents.get(x.id)!);
  const k = Math.max(1, Math.round(ranked.length * GROUP_FRACTION));
  const enoughForDiscrimination = ranked.length >= MIN_FOR_DISCRIMINATION;
  const top = new Set(ranked.slice(0, k).map(a => a.id));
  const bottom = new Set(ranked.slice(-k).map(a => a.id));

  const histogram = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i * 10 + 10, count: 0 }));
  for (const p of sortedPercents) {
    histogram[Math.min(9, Math.floor(p / 10))]!.count += 1;
  }

  const questions: QuestionStat[] = [...input.questions]
    .sort((a, b) => a.order - b.order)
    .map((q) => {
      const takers = input.attempts.filter(a => assignedOf(a).has(q.id));
      const n = takers.length;
      const counts = new Map(q.options.map(o => [o.order, 0]));
      let scoreSum = 0;
      let fullyCorrect = 0;
      let unanswered = 0;
      const topScores: number[] = [];
      const bottomScores: number[] = [];

      for (const a of takers) {
        const selected = normalizeSelected(a.answers[q.id]);
        if (selected.length === 0) {
          unanswered += 1;
        }
        for (const o of selected) {
          if (counts.has(o)) {
            counts.set(o, counts.get(o)! + 1);
          }
        }
        const qScore = a.questionScores[q.id] ?? 0;
        scoreSum += qScore;
        // "Đúng" = chọn đúng chính xác tập đáp án đúng, không phụ thuộc chế độ chấm
        if (scoreQuestion(q.options, selected, { mode: 'all_or_nothing', partialMethod: 'edc', penaltyPerWrongOption: 0, rounding: 'none' }).isFullyCorrect) {
          fullyCorrect += 1;
        }
        if (top.has(a.id)) {
          topScores.push(qScore);
        }
        if (bottom.has(a.id)) {
          bottomScores.push(qScore);
        }
      }

      const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
      const discrimination = enoughForDiscrimination && topScores.length > 0 && bottomScores.length > 0
        ? round(mean(topScores) - mean(bottomScores))
        : null;

      const options = [...q.options]
        .sort((a, b) => a.order - b.order)
        .map(o => ({
          order: o.order,
          content: o.content,
          isCorrect: o.isCorrect,
          count: counts.get(o.order) ?? 0,
          rate: n > 0 ? round((counts.get(o.order) ?? 0) / n) : null,
        }));
      const wrongPicked = options.filter(o => !o.isCorrect && o.count > 0).sort((a, b) => b.count - a.count);

      const correctRate = n > 0 ? round(fullyCorrect / n) : null;
      const labels: QuestionLabel[] = [];
      if (correctRate !== null && correctRate < LABEL_THRESHOLDS.hardBelow) {
        labels.push('hard');
      }
      if (correctRate !== null && correctRate > LABEL_THRESHOLDS.easyAbove) {
        labels.push('easy');
      }
      if (discrimination !== null && discrimination < LABEL_THRESHOLDS.reviewDiscriminationBelow) {
        labels.push('review');
      }

      return {
        id: q.id,
        order: q.order,
        type: q.type,
        prompt: q.prompt,
        imageUrl: q.imageUrl ?? null,
        imageAlt: q.imageAlt ?? null,
        n,
        avgScore: n > 0 ? round(scoreSum / n) : null,
        correctRate,
        unansweredRate: n > 0 ? round(unanswered / n) : null,
        discrimination,
        options,
        topDistractor: wrongPicked[0]?.order ?? null,
        labels,
      };
    });

  const sum = sortedPercents.reduce((s, x) => s + x, 0);
  return {
    summary: {
      submitted: input.attempts.length,
      meanPercent: sortedPercents.length ? round(sum / sortedPercents.length, 1) : null,
      medianPercent: (() => {
        const m = median(sortedPercents);
        return m === null ? null : round(m, 1);
      })(),
      minPercent: sortedPercents.length ? round(sortedPercents[0]!, 1) : null,
      maxPercent: sortedPercents.length ? round(sortedPercents[sortedPercents.length - 1]!, 1) : null,
    },
    histogram,
    questions,
  };
}
