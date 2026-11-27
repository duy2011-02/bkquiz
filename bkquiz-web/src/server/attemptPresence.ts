import { LAST_SEEN_WRITE_INTERVAL_SECONDS } from '@/server/liveStatus';
import { prisma } from '@/server/prisma';

/**
 * Ghi nhận máy sinh viên vẫn đang kết nối (`Attempt.lastSeenAt`).
 * Chỉ ghi khi giá trị cũ hơn LAST_SEEN_WRITE_INTERVAL_SECONDS → tối đa 1 lần ghi / 10 s / sinh viên
 * dù client poll `state` mỗi 1,5 s. Lỗi được bỏ qua: không được làm hỏng request chính.
 */
export async function touchAttemptLastSeen(attemptId: string, now = new Date()): Promise<void> {
  const threshold = new Date(now.getTime() - LAST_SEEN_WRITE_INTERVAL_SECONDS * 1000);
  await prisma.attempt.updateMany({
    where: {
      id: attemptId,
      status: { not: 'submitted' },
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: threshold } }],
    },
    data: { lastSeenAt: now },
  }).catch(() => null);
}
