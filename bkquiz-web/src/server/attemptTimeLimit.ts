import { prisma } from '@/server/prisma';

type AttemptWithSession = {
  attemptStartedAt: Date | null;
  quizSession: {
    startedAt: Date | null;
    settings: unknown;
  };
};

export type SessionTimeSettings = {
  durationSeconds?: number;
  bufferMinutes?: number;
  extensionSeconds?: number; // Tổng thời gian giáo viên đã gia hạn khi session đang chạy
};

export const DEFAULT_BUFFER_MINUTES = 5;
export const MAX_EXTENSION_SECONDS = 120 * 60;

/**
 * Thời lượng làm bài thực tế = durationSeconds + extensionSeconds.
 * Trả null nếu session không giới hạn thời gian.
 */
export function getEffectiveDurationSeconds(settings: unknown): number | null {
  const s = settings as SessionTimeSettings | null;
  const durationSeconds = s?.durationSeconds;
  if (!durationSeconds) {
    return null;
  }
  const extensionSeconds = typeof s?.extensionSeconds === 'number' ? s.extensionSeconds : 0;
  return durationSeconds + extensionSeconds;
}

/**
 * Thời điểm session tự đóng = startedAt + thời lượng thực tế + bufferMinutes.
 */
export function calculateSessionEndTime(startedAt: Date, settings: unknown): Date | null {
  const effective = getEffectiveDurationSeconds(settings);
  if (!effective) {
    return null;
  }
  const bufferMinutes = (settings as SessionTimeSettings | null)?.bufferMinutes ?? DEFAULT_BUFFER_MINUTES;
  return new Date(startedAt.getTime() + effective * 1000 + bufferMinutes * 60 * 1000);
}

/**
 * Tính toán thời gian kết thúc của attempt
 * Logic (thời lượng đã cộng phần gia hạn):
 * - attemptEndTime = attemptStartedAt + effectiveDuration
 * - sessionEndTime = session.startedAt + effectiveDuration + bufferMinutes
 * - actualEndTime = min(attemptEndTime, sessionEndTime)
 */
export function calculateAttemptEndTime(
  attempt: AttemptWithSession,
): Date | null {
  if (!attempt.attemptStartedAt || !attempt.quizSession.startedAt) {
    return null; // Chưa bắt đầu hoặc session chưa start
  }

  const effective = getEffectiveDurationSeconds(attempt.quizSession.settings);
  const sessionEndTime = calculateSessionEndTime(attempt.quizSession.startedAt, attempt.quizSession.settings);
  if (!effective || !sessionEndTime) {
    return null; // Không có time limit
  }

  // Thời gian kết thúc của attempt (từ lúc bắt đầu làm bài)
  const attemptEndTime = new Date(attempt.attemptStartedAt.getTime() + effective * 1000);

  // Lấy thời gian sớm hơn (strict enforcement)
  return attemptEndTime < sessionEndTime ? attemptEndTime : sessionEndTime;
}

/**
 * Validate xem attempt còn trong thời gian cho phép không
 * Returns: { valid: boolean, timeRemaining: number | null, isTimeUp: boolean }
 */
export async function validateAttemptTimeLimit(
  attemptId: string,
): Promise<{ valid: boolean; timeRemaining: number | null; isTimeUp: boolean; attemptEndTime: Date | null }> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      attemptStartedAt: true,
      status: true,
      quizSession: {
        select: {
          startedAt: true,
          settings: true,
        },
      },
    },
  });

  if (!attempt) {
    return { valid: false, timeRemaining: null, isTimeUp: true, attemptEndTime: null };
  }

  // Nếu đã submit rồi, không cần check
  if (attempt.status === 'submitted') {
    return { valid: true, timeRemaining: null, isTimeUp: false, attemptEndTime: null };
  }

  // Nếu chưa bắt đầu làm bài, cho phép
  if (!attempt.attemptStartedAt) {
    return { valid: true, timeRemaining: null, isTimeUp: false, attemptEndTime: null };
  }

  const attemptEndTime = calculateAttemptEndTime(attempt);
  if (!attemptEndTime) {
    return { valid: true, timeRemaining: null, isTimeUp: false, attemptEndTime: null };
  }

  const now = new Date();
  const timeRemaining = Math.max(0, Math.floor((attemptEndTime.getTime() - now.getTime()) / 1000));
  const isTimeUp = now >= attemptEndTime;

  return {
    valid: !isTimeUp,
    timeRemaining,
    isTimeUp,
    attemptEndTime,
  };
}
