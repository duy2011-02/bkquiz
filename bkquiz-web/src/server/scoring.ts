/**
 * Chấm điểm bài làm — hàm thuần, không truy cập database.
 * Dùng bởi `api/attempts/[attemptId]/submit` (qua `submitAttempt.ts`) và có unit test ở `scoring.test.ts`.
 *
 * Mỗi câu tối đa 1 điểm. Phương án được định danh bằng `order` (0, 1, 2, …) trong snapshot của session.
 */

export type ScoringMode = 'all_or_nothing' | 'partial' | 'penalty';
export type PartialCreditMethod = 'edc' | 'halves';
export type ScoreRounding = 'none' | 'round_2';

/** Cấu hình chấm lưu trong `quiz.settings.scoring` (mọi trường đều tuỳ chọn). */
export type ScoringSettings = {
  mode?: ScoringMode;
  partialCreditMethod?: PartialCreditMethod;
  penaltyPerWrongOption?: number;
  rounding?: ScoreRounding;
};

export type ResolvedScoring = {
  mode: ScoringMode;
  partialMethod: PartialCreditMethod;
  penaltyPerWrongOption: number;
  rounding: ScoreRounding;
};

export type ScorableOption = { order: number; isCorrect: boolean };
export type ScorableQuestion = { id: string; options: ScorableOption[] };

export const DEFAULT_PENALTY_PER_WRONG_OPTION = 0.25;

/** Điền giá trị mặc định cho cấu hình chấm đọc từ `quiz.settings.scoring`. */
export function resolveScoringSettings(raw: unknown): ResolvedScoring {
  const s = (raw ?? {}) as ScoringSettings;
  return {
    mode: s.mode ?? 'all_or_nothing',
    partialMethod: s.partialCreditMethod ?? 'edc',
    penaltyPerWrongOption: typeof s.penaltyPerWrongOption === 'number'
      ? s.penaltyPerWrongOption
      : DEFAULT_PENALTY_PER_WRONG_OPTION,
    rounding: s.rounding ?? 'round_2',
  };
}

/** Lựa chọn lưu trong `Answer.selected` (JSON) → mảng số nguyên không trùng, tăng dần. */
export function normalizeSelected(x: unknown): number[] {
  const arr = Array.isArray(x) ? x : [];
  return Array.from(new Set(arr.filter(n => Number.isInteger(n)).map(n => Number(n)))).sort((a, b) => a - b);
}

export function roundScore(score: number, rounding: ScoreRounding): number {
  if (rounding === 'round_2') {
    return Math.round(score * 100) / 100;
  }
  return score;
}

/** Đúng hoàn toàn mới được 1 điểm. `selected` và `correct` đều đã sắp xếp tăng dần. */
export function computeAllOrNothing(selected: number[], correct: number[]): number {
  const ok = selected.length === correct.length && selected.every((v, i) => v === correct[i]);
  return ok ? 1 : 0;
}

/**
 * Every Decision Counts: mỗi phương án là 1 quyết định (chọn / không chọn).
 * Quyết định đúng = chọn phương án đúng hoặc không chọn phương án sai.
 */
export function computeEDC(selected: number[], correct: Set<number>, optionCount: number): number {
  if (optionCount <= 0) {
    return 0;
  }
  let correctDecisions = 0;
  for (let order = 0; order < optionCount; order += 1) {
    const isCorrect = correct.has(order);
    const isSelected = selected.includes(order);
    const decisionOk = (isCorrect && isSelected) || (!isCorrect && !isSelected);
    if (decisionOk) {
      correctDecisions += 1;
    }
  }
  return correctDecisions / optionCount;
}

/**
 * Chia đôi: mỗi lỗi (chọn phương án sai hoặc bỏ sót phương án đúng) mất một nửa số điểm còn lại.
 * 0 lỗi → 1, 1 lỗi → 0,5, 2 lỗi → 0,25, từ 3 lỗi → 0.
 */
export function computeByHalves(selected: number[], correct: Set<number>, optionCount: number): number {
  let errors = 0;
  for (let order = 0; order < optionCount; order += 1) {
    const isCorrect = correct.has(order);
    const isSelected = selected.includes(order);
    if ((isCorrect && !isSelected) || (!isCorrect && isSelected)) {
      errors += 1;
    }
  }
  if (errors === 0) {
    return 1;
  }
  if (errors === 1) {
    return 0.5;
  }
  if (errors === 2) {
    return 0.25;
  }
  return 0;
}

/**
 * Trừ điểm: chọn được ít nhất 1 phương án đúng → 1 điểm, mỗi phương án sai đã chọn trừ `penaltyPerWrongOption`;
 * không âm. Không trừ khi bỏ sót phương án đúng.
 */
export function computePenalty(
  selected: number[],
  correct: Set<number>,
  optionCount: number,
  penaltyPerWrongOption: number,
): number {
  const hasAnyCorrect = selected.some(o => correct.has(o));
  const base = hasAnyCorrect ? 1 : 0;
  const wrong = selected.filter(o => !correct.has(o) && o >= 0 && o < optionCount).length;
  return Math.max(0, base - wrong * penaltyPerWrongOption);
}

/** Chấm 1 câu. `score` chưa làm tròn; `isFullyCorrect` = chọn đúng chính xác tập đáp án đúng. */
export function scoreQuestion(
  options: ScorableOption[],
  selectedRaw: unknown,
  scoring: ResolvedScoring,
): { score: number; isFullyCorrect: boolean } {
  const optionCount = options.length;
  const correctOrders = options
    .filter(o => o.isCorrect)
    .map(o => o.order)
    .sort((a, b) => a - b);
  const correctSet = new Set<number>(correctOrders);
  const selected = normalizeSelected(selectedRaw);

  const isFullyCorrect = selected.length === correctOrders.length
    && selected.every((v, i) => v === correctOrders[i]);

  let score: number;
  if (scoring.mode === 'all_or_nothing') {
    score = computeAllOrNothing(selected, correctOrders);
  } else if (scoring.mode === 'partial') {
    score = scoring.partialMethod === 'halves'
      ? computeByHalves(selected, correctSet, optionCount)
      : computeEDC(selected, correctSet, optionCount);
  } else {
    score = computePenalty(selected, correctSet, optionCount, scoring.penaltyPerWrongOption);
  }
  return { score, isFullyCorrect };
}

/**
 * Chấm cả bài trên danh sách câu **được giao** cho bài làm (đề biến thể: mỗi sinh viên một tập con câu).
 * - `answers`: `sessionQuestionId` → `Answer.selected`; câu không có đáp án coi như bỏ trống.
 * - `questionScores`: điểm từng câu đã làm tròn (cache vào `Attempt.questionScores`).
 * - `score`: tổng điểm **chưa làm tròn** từng câu, làm tròn một lần ở cuối.
 */
export function scoreAttempt(input: {
  questions: ScorableQuestion[];
  answers: ReadonlyMap<string, unknown>;
  scoring: ResolvedScoring;
}): { score: number; correctCount: number; totalQuestions: number; questionScores: Record<string, number> } {
  let total = 0;
  let correctCount = 0;
  const questionScores: Record<string, number> = {};

  for (const q of input.questions) {
    const { score, isFullyCorrect } = scoreQuestion(q.options, input.answers.get(q.id), input.scoring);
    if (isFullyCorrect) {
      correctCount += 1;
    }
    questionScores[q.id] = roundScore(score, input.scoring.rounding);
    total += score;
  }

  return {
    score: roundScore(total, input.scoring.rounding),
    correctCount,
    totalQuestions: input.questions.length,
    questionScores,
  };
}
