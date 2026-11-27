import { NextResponse } from 'next/server';
import { calculateAttemptEndTime, calculateSessionEndTime } from '@/server/attemptTimeLimit';
import { requireUser } from '@/server/authz';
import { prisma } from '@/server/prisma';
import { buildSessionSnapshotIfNeeded } from '@/server/quizSnapshot';
import { cleanupRateLimits } from '@/server/rateLimit';

/**
 * Còn bài đang làm trong giờ gia hạn riêng (giáo viên gia hạn cho từng sinh viên trên trang giám sát)?
 * Khi đó chưa tự đóng session dù đã qua mốc chung.
 */
async function hasAttemptInExtraTime(session: { id: string; startedAt: Date | null; settings: unknown }, now: Date) {
  const extended = await prisma.attempt.findMany({
    where: { sessionId: session.id, status: { in: ['active', 'locked'] }, extraSeconds: { gt: 0 } },
    select: { attemptStartedAt: true, extraSeconds: true },
  });
  return extended.some((a) => {
    const end = calculateAttemptEndTime({ ...a, quizSession: { startedAt: session.startedAt, settings: session.settings } });
    return end !== null && end > now;
  });
}

function hasCronSecret(req: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Ai được kích hoạt: cron (header `Authorization: Bearer <CRON_SECRET>`) hoặc người đã đăng nhập (màn chiếu của
 * giáo viên gọi khi đang mở). Endpoint chỉ bắt đầu / kết thúc phiên đã đến giờ nên cho người đăng nhập gọi là an toàn.
 * Không đặt CRON_SECRET (dev) → ai cũng gọi được.
 * Trước đây khi có CRON_SECRET thì màn chiếu (không có header) bị 401, và kiểm tra thêm user-agent
 * `vercel-cron/1.0` — giả mạo được.
 */
async function isAllowed(req: Request) {
  if (!process.env.CRON_SECRET || hasCronSecret(req)) {
    return true;
  }
  try {
    await requireUser();
    return true;
  } catch {
    return false;
  }
}

/**
 * Tự động start / end sessions. Được gọi từ:
 * - Vercel Cron (GET kèm `Authorization: Bearer <CRON_SECRET>`, cấu hình trong `vercel.json`) hoặc cron ngoài;
 * - màn chiếu của giáo viên (POST) khi đang mở.
 */
export async function POST(req: Request) {
  if (!(await isAllowed(req))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const now = new Date();
  const results = {
    autoStarted: [] as string[],
    autoEnded: [] as string[],
    errors: [] as string[],
  };

  try {
    // 1. Auto-start sessions: Find sessions in 'lobby' status with scheduledStartAt <= now
    // We need to check settings.scheduledStartAt, not just startedAt
    const allLobbySessions = await prisma.quizSession.findMany({
      where: {
        status: 'lobby',
      },
    });

    const sessionsToStart = allLobbySessions.filter((session) => {
      const settings = session.settings as { scheduledStartAt?: string } | null;
      if (!settings?.scheduledStartAt) {
        return false;
      }
      const scheduledTime = new Date(settings.scheduledStartAt);
      return scheduledTime <= now;
    });

    for (const session of sessionsToStart) {
      try {
        // Check if session has scheduledStartAt in settings
        const settings = session.settings as { scheduledStartAt?: string } | null;
        if (settings?.scheduledStartAt) {
          const scheduledTime = new Date(settings.scheduledStartAt);
          if (scheduledTime <= now) {
            // Auto-start the session (same logic as manual start)
            await prisma.quizSession.update({
              where: { id: session.id },
              data: {
                status: 'active',
                startedAt: now, // Update to actual start time
                endedAt: null,
              },
            });

            // Build session snapshot (same as manual start) - this creates question snapshots
            try {
              await buildSessionSnapshotIfNeeded(session.id);
            } catch (snapshotErr) {
              console.error(`Error building snapshot for session ${session.id}:`, snapshotErr);
              // Continue even if snapshot build fails - it might already exist
            }

            results.autoStarted.push(session.id);
          }
        }
      } catch (err) {
        results.errors.push(`Failed to start session ${session.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 2. Auto-end sessions: Find active sessions that should be ended
    // End time = startedAt + durationSeconds + bufferMinutes
    const activeSessions = await prisma.quizSession.findMany({
      where: {
        status: 'active',
        startedAt: { not: null },
      },
    });

    for (const session of activeSessions) {
      try {
        if (!session.startedAt) {
          continue;
        }

        // Đã tính cả thời gian giáo viên gia hạn (extensionSeconds)
        const endTime = calculateSessionEndTime(session.startedAt, session.settings);

        if (endTime) {
          if (endTime <= now && !(await hasAttemptInExtraTime(session, now))) {
            // Auto-end the session
            await prisma.quizSession.update({
              where: { id: session.id },
              data: {
                status: 'ended',
                endedAt: now,
              },
            });
            results.autoEnded.push(session.id);
          }
        }
      } catch (err) {
        results.errors.push(`Failed to end session ${session.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 3. Dọn bộ đếm rate limit cũ hơn 1 ngày (có index theo windowStart nên rẻ)
    let rateLimitCleaned = 0;
    try {
      rateLimitCleaned = await cleanupRateLimits(24, now);
    } catch (err) {
      results.errors.push(`Failed to clean rate limits: ${err instanceof Error ? err.message : String(err)}`);
    }

    return NextResponse.json({
      rateLimitCleaned,
      success: true,
      timestamp: now.toISOString(),
      ...results,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        ...results,
      },
      { status: 500 },
    );
  }
}

/**
 * Vercel Cron gọi bằng GET (kèm `Authorization: Bearer <CRON_SECRET>`) → chạy như POST.
 * Không có secret → chỉ trả trạng thái (health check).
 */
export async function GET(req: Request) {
  if (hasCronSecret(req)) {
    return POST(req);
  }
  return NextResponse.json({
    status: 'ok',
    message: 'Auto session management endpoint',
    timestamp: new Date().toISOString(),
  });
}
