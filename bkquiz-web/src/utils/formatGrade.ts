/** Điểm thang 10 để hiển thị: tối đa 2 chữ số thập phân, bỏ số 0 thừa (10, 7.5, 6.67). */
export function formatGrade(grade: number): string {
  return String(Math.round(grade * 100) / 100);
}

/**
 * Quy điểm thô của 1 câu (0–1) về thang 10 của cả bài: mỗi câu tối đa 10 / số câu.
 * Ví dụ 5 câu: câu đúng = 2; 20 câu: câu đúng = 0.5.
 */
export function questionPointsOnTenScale(rawScore: number, totalQuestions: number): number {
  return totalQuestions > 0 ? (rawScore * 10) / totalQuestions : 0;
}
