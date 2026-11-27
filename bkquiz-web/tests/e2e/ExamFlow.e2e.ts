import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Luồng thi đầy đủ với 2 người dùng (giáo viên + sinh viên, mỗi người một browser context):
 * dựng lớp / ngân hàng câu hỏi / quiz / phiên qua API → sinh viên vào phòng chờ và làm bài trên giao diện →
 * checkpoint: nhập sai 3 lần → bị chờ → giáo viên mở khoá trên trang Theo dõi → nhập token đúng →
 * nộp bài → giáo viên thấy điểm trên trang Theo dõi, Thống kê và chi tiết bài làm.
 *
 * Cần Postgres Docker (docker compose up -d). playwright.config.ts chạy server riêng ở cổng 3300 với
 * database `bkquiz_e2e`, DEV_BYPASS_AUTH=1 và BKQUIZ_CHECKPOINT_SECONDS=10.
 */

const CHECKPOINT_SECONDS = 10;
const QUESTIONS = [
  { prompt: 'E2E câu 1: 1 + 1 = ?', options: ['1', '2', '3', '4'] },
  { prompt: 'E2E câu 2: 2 × 3 = ?', options: ['5', '6', '7', '8'] },
  { prompt: 'E2E câu 3: 10 − 4 = ?', options: ['4', '6', '8', '10'] },
];
/** Mọi câu đều có đáp án đúng là phương án thứ 2 (order 1); thứ tự hiển thị bị xáo nhưng data-order giữ order gốc */
const CORRECT_ORDER = 1;

async function loginAs(context: BrowserContext, role: 'teacher' | 'student') {
  const res = await context.request.get(`/api/dev/role?role=${role}&next=/api/health`);

  expect(res.ok()).toBeTruthy();
}

async function postJson<T>(api: APIRequestContext, url: string, data?: unknown): Promise<T> {
  const res = await api.post(url, data === undefined ? undefined : { data });
  const body = await res.json();

  expect(res.ok(), `${url} → ${res.status()} ${JSON.stringify(body)}`).toBeTruthy();

  return body as T;
}

async function checkpointInput(page: Page) {
  const input = page.locator('#checkpointToken');

  await expect(input).toBeVisible({ timeout: (CHECKPOINT_SECONDS + 20) * 1000 });

  return input;
}

test.describe('Exam flow', () => {
  test.describe.configure({ mode: 'serial', timeout: 4 * 60 * 1000 });

  test('teacher runs a session, student takes it with checkpoints, teacher unlocks and reviews', async ({ browser }) => {
    const stamp = Date.now().toString(36);
    const teacher = await browser.newContext();
    const student = await browser.newContext();
    await loginAs(teacher, 'teacher');
    await loginAs(student, 'student');
    const tApi = teacher.request;
    const sApi = student.request;

    // ---------- Dựng dữ liệu (API) ----------
    const classroom = await postJson<{ id: string; classCode: string }>(tApi, '/api/classes', { name: `E2E lớp ${stamp}` });
    await postJson(sApi, '/api/classes/join', { classCode: classroom.classCode });

    const pool = await postJson<{ id: string }>(tApi, '/api/pools', { name: `E2E pool ${stamp}` });
    for (const q of QUESTIONS) {
      await postJson(tApi, `/api/pools/${pool.id}/questions`, {
        type: 'mcq_single',
        prompt: q.prompt,
        options: q.options.map((content, i) => ({ content, isCorrect: i === CORRECT_ORDER })),
        tags: [`e2e-${stamp}`],
      });
    }

    const quiz = await postJson<{ id: string }>(tApi, '/api/quizzes', { title: `E2E quiz ${stamp}`, status: 'published' });
    await postJson(tApi, `/api/quizzes/${quiz.id}/rules`, { tag: `e2e-${stamp}`, mode: 'same', count: QUESTIONS.length, poolIds: [pool.id] });

    const { sessionId } = await postJson<{ sessionId: string }>(tApi, '/api/sessions', {
      classroomId: classroom.id,
      quizId: quiz.id,
      sessionName: `E2E phiên ${stamp}`,
      durationSeconds: 900,
    });

    try {
      // ---------- Giáo viên mở phiên trên màn chiếu ----------
      const screen = await teacher.newPage();
      await screen.goto(`/vi/dashboard/sessions/${sessionId}/teacher`);
      await screen.getByRole('button', { name: /Bắt đầu/ }).click();

      await expect(screen.getByText(/đang diễn ra/i).first()).toBeVisible();

      // ---------- Sinh viên vào làm bài ----------
      const page = await student.newPage();
      await page.goto(`/vi/session/${sessionId}`);

      await expect(page.getByText('hệ thống ghi nhận số lần bạn rời khỏi trang')).toBeVisible();

      await page.getByRole('button', { name: /Vào làm bài/ }).click();
      await page.waitForURL(/\/attempt\//);
      const attemptId = page.url().split('/attempt/')[1]!.split(/[?#]/)[0]!;

      await page.locator(`label[data-order="${CORRECT_ORDER}"]`).click();

      // ---------- Checkpoint: nhập sai 3 lần → phải chờ ----------
      let input = await checkpointInput(page);
      for (let i = 1; i <= 3; i += 1) {
        input = await checkpointInput(page);
        await input.fill('000000');
        await page.getByRole('button', { name: 'Xác nhận' }).click();

        await expect(page.getByText(`Sai: ${i}`)).toBeVisible({ timeout: 15_000 });
      }

      await expect(page.locator('#checkpointToken')).toBeDisabled({ timeout: 15_000 }); // đang cooldown 30 s

      // ---------- Giáo viên mở khoá trên trang Theo dõi ----------
      const monitor = await teacher.newPage();
      await monitor.goto(`/vi/dashboard/sessions/${sessionId}/monitor`);

      await expect(monitor.getByText('Đang chờ (nhập sai)').first()).toBeVisible();

      await monitor.getByRole('button', { name: 'Mở khoá' }).click();

      await expect(monitor.getByRole('status').filter({ hasText: 'Đã mở khoá' })).toBeVisible();

      // Hộp thoại checkpoint đóng lại; sinh viên làm tiếp được
      await expect(page.locator('#checkpointToken')).toBeHidden({ timeout: 15_000 });

      // ---------- Checkpoint kế tiếp: nhập token đúng từ màn hình giáo viên ----------
      input = await checkpointInput(page);

      await expect(input).toBeEnabled();

      const { token } = await (await tApi.get(`/api/sessions/${sessionId}/teacherToken`)).json() as { token: string };
      await input.fill(token);
      await page.getByRole('button', { name: 'Xác nhận' }).click();

      // Phương án được đặt tên theo nội dung label ("B" + nội dung phương án, ví dụ "B 2" hoặc "B 6" tuỳ câu đang hiện —
      // thứ tự câu được xáo), không còn aria-label "option:N"
      const correctContents = QUESTIONS.map(q => q.options[CORRECT_ORDER]).join('|');

      await expect(page.locator(`label[data-order="${CORRECT_ORDER}"] input`)).toHaveAccessibleName(new RegExp(`^B\\s*(${correctContents})$`));

      await expect(page.locator('#checkpointToken')).toBeHidden({ timeout: 15_000 });

      // ---------- Trả lời các câu còn lại rồi nộp (còn ~15 s trước checkpoint kế) ----------
      for (let i = 1; i < QUESTIONS.length; i += 1) {
        await page.getByRole('button', { name: /Sau/ }).click();
        await page.locator(`label[data-order="${CORRECT_ORDER}"]`).click();
      }
      await page.getByRole('button', { name: 'Nộp bài' }).first().click();
      const confirm = page.getByRole('dialog');

      await expect(confirm).toBeVisible();

      await confirm.getByRole('button', { name: 'Nộp bài' }).click();

      // ---------- Giáo viên xem kết quả ----------
      await expect.poll(async () => {
        const res = await tApi.get(`/api/sessions/${sessionId}/report/scoreboard`);
        const { attempts } = await res.json() as { attempts: Array<{ id: string; status: string; score: number | null; grade: number | null }> };
        return attempts.find(a => a.id === attemptId);
      }, { timeout: 20_000 }).toMatchObject({ status: 'submitted', score: QUESTIONS.length, grade: 10, correctCount: QUESTIONS.length, totalQuestions: QUESTIONS.length });

      await monitor.reload();

      await expect(monitor.getByText('Đã nộp').first()).toBeVisible();
      await expect(monitor.getByText(`Điểm 10/10 (đúng ${QUESTIONS.length}/${QUESTIONS.length} câu)`)).toBeVisible();

      const stats = await teacher.newPage();
      await stats.goto(`/vi/dashboard/sessions/${sessionId}/stats`);

      await expect(stats.getByRole('heading', { name: 'Thống kê câu hỏi' })).toBeVisible();
      await expect(stats.locator('dt', { hasText: 'Bài đã nộp' }).locator('xpath=following-sibling::dd[1]')).toHaveText('1');
      await expect(stats.getByText(`Từng câu hỏi (${QUESTIONS.length})`)).toBeVisible();

      const detail = await teacher.newPage();
      await detail.goto(`/vi/dashboard/sessions/${sessionId}/attempts/${attemptId}`);

      await expect(detail.getByText('Giáo viên mở khoá')).toBeVisible();
      await expect(detail.getByText('Token sai').first()).toBeVisible();

      // ---------- Phân quyền: sinh viên không xem được trang/API của giáo viên ----------
      expect((await sApi.get(`/api/sessions/${sessionId}/monitor`)).status()).toBe(403);
      expect((await sApi.get(`/api/sessions/${sessionId}/report/questionStats`)).status()).toBe(403);
    } finally {
      // Dọn phiên (lớp / pool / quiz giữ lại, tên có dấu thời gian nên không đụng nhau giữa các lần chạy)
      await tApi.post(`/api/sessions/${sessionId}/end`);
      await tApi.delete(`/api/sessions/${sessionId}`);
      await teacher.close();
      await student.close();
    }
  });
});
