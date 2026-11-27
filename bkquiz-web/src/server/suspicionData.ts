import type { SuspicionFlag } from '@/server/suspicion';
import { prisma } from '@/server/prisma';
import { countSharedDeviceAccounts, evaluateFlags } from '@/server/suspicion';

/**
 * Tính cờ nghi vấn cho mọi bài làm của một phiên bằng vài truy vấn gộp (không đọc từng sự kiện),
 * đủ rẻ để gọi mỗi 3 s từ trang giám sát. Cờ được tính khi đọc nên luôn khớp dữ liệu mới nhất.
 */
export async function computeSessionFlags(sessionId: string): Promise<Map<string, SuspicionFlag[]>> {
  const [attempts, eventStats, deviceEvents, tokenFails, snapshotCount] = await Promise.all([
    prisma.attempt.findMany({
      where: { sessionId },
      select: {
        id: true,
        userId: true,
        status: true,
        score: true,
        attemptStartedAt: true,
        submittedAt: true,
        deviceId: true,
        _count: { select: { attemptQuestions: true } },
      },
    }),
    prisma.attemptEvent.groupBy({
      by: ['attemptId', 'type'],
      where: { attempt: { sessionId }, type: { not: 'device_changed' } },
      _count: { _all: true },
      _sum: { durationMs: true },
    }),
    prisma.attemptEvent.findMany({
      where: { attempt: { sessionId }, type: 'device_changed' },
      select: { attemptId: true, deviceId: true },
    }),
    prisma.checkpointLog.groupBy({
      by: ['attemptId'],
      where: { attempt: { sessionId }, type: { in: ['verify_fail', 'locked'] } },
      _count: { _all: true },
    }),
    prisma.sessionQuestionSnapshot.count({ where: { sessionId } }),
  ]);

  const stats = new Map<string, Record<string, { count: number; ms: number }>>();
  for (const row of eventStats) {
    const byType = stats.get(row.attemptId) ?? {};
    byType[row.type] = { count: row._count._all, ms: row._sum.durationMs ?? 0 };
    stats.set(row.attemptId, byType);
  }
  const fails = new Map(tokenFails.map(r => [r.attemptId, r._count._all]));

  const devicesByAttempt = new Map<string, { userId: string; devices: Set<string> }>();
  for (const a of attempts) {
    devicesByAttempt.set(a.id, { userId: a.userId, devices: new Set(a.deviceId ? [a.deviceId] : []) });
  }
  for (const e of deviceEvents) {
    if (e.deviceId) {
      devicesByAttempt.get(e.attemptId)?.devices.add(e.deviceId);
    }
  }
  const shared = countSharedDeviceAccounts(devicesByAttempt);

  const result = new Map<string, SuspicionFlag[]>();
  for (const a of attempts) {
    const s = stats.get(a.id) ?? {};
    const get = (type: string) => s[type] ?? { count: 0, ms: 0 };
    const assignedCount = a._count.attemptQuestions || snapshotCount;
    const submitted = a.status === 'submitted' && a.submittedAt && a.attemptStartedAt && a.score !== null
      ? { durationSeconds: (a.submittedAt.getTime() - a.attemptStartedAt.getTime()) / 1000, score: a.score }
      : null;
    result.set(a.id, evaluateFlags({
      tabHiddenCount: get('tab_hidden').count,
      tabHiddenMs: get('tab_hidden').ms,
      blurCount: get('window_blur').count,
      blurMs: get('window_blur').ms,
      copyCount: get('copy').count,
      pasteCount: get('paste').count,
      deviceCount: devicesByAttempt.get(a.id)?.devices.size ?? 0,
      sharedDeviceAccounts: shared.get(a.id) ?? 0,
      tokenFailCount: fails.get(a.id) ?? 0,
      assignedCount,
      submitted,
    }));
  }
  return result;
}

/**
 * Ghi nhận thiết bị của request (header `x-bkquiz-device`) cho một bài làm đang làm.
 * - Chưa có thiết bị → lưu làm thiết bị đầu tiên.
 * - Khác thiết bị đã lưu → một sự kiện `device_changed` cho mỗi thiết bị mới (unique, ghi trùng bị bỏ qua).
 * Lỗi được bỏ qua: không được làm hỏng request chính.
 */
export async function recordAttemptDevice(
  attempt: { id: string; deviceId: string | null; status: string },
  deviceId: string | null,
  now = new Date(),
): Promise<void> {
  if (!deviceId || attempt.status === 'submitted' || attempt.deviceId === deviceId) {
    return;
  }
  try {
    if (!attempt.deviceId) {
      await prisma.attempt.updateMany({ where: { id: attempt.id, deviceId: null }, data: { deviceId } });
      return;
    }
    await prisma.attemptEvent.createMany({
      data: [{ attemptId: attempt.id, type: 'device_changed', at: now, deviceId }],
      skipDuplicates: true,
    });
  } catch {
    // best effort
  }
}
