/** Gọi API nhân bản quiz; `title` là tiêu đề bản sao đã dịch. Trả id quiz mới hoặc mã lỗi. */
export async function duplicateQuiz(quizId: string, title: string): Promise<{ id: string } | { error: string }> {
  try {
    const res = await fetch(`/api/quizzes/${quizId}/duplicate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const json = await res.json().catch(() => null) as { quiz?: { id: string }; error?: string } | null;
    if (!res.ok || !json?.quiz) {
      return { error: json?.error ?? 'DUPLICATE_FAILED' };
    }
    return { id: json.quiz.id };
  } catch {
    return { error: 'DUPLICATE_FAILED' };
  }
}
