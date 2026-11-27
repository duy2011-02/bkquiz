'use client';

import { useEffect } from 'react';
import { deviceHeaders } from '@/utils/deviceId';

type ProctorEvent = {
  type: 'tab_hidden' | 'window_blur' | 'copy' | 'paste';
  at: string;
  durationMs?: number;
};

/** Bỏ qua lần rời trang ngắn hơn (chớp tắt cửa sổ, bấm nhầm). */
const MIN_AWAY_MS = 1000;
const FLUSH_INTERVAL_MS = 10_000;
const BATCH_SIZE = 50;
/** Giữ tối đa bấy nhiêu sự kiện chờ gửi khi mất mạng lâu. */
const MAX_QUEUE = 500;

const queueKey = (attemptId: string) => `bkquiz_events_${attemptId}`;

function readQueue(attemptId: string): ProctorEvent[] {
  try {
    const raw = window.localStorage.getItem(queueKey(attemptId));
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    return Array.isArray(parsed) ? parsed as ProctorEvent[] : [];
  } catch {
    return [];
  }
}

function writeQueue(attemptId: string, events: ProctorEvent[]) {
  try {
    if (events.length === 0) {
      window.localStorage.removeItem(queueKey(attemptId));
    } else {
      window.localStorage.setItem(queueKey(attemptId), JSON.stringify(events.slice(-MAX_QUEUE)));
    }
  } catch {
    // localStorage bị chặn → bỏ qua, không ảnh hưởng việc làm bài
  }
}

/**
 * Ghi nhận hành vi khi làm bài để gắn cờ nghi vấn cho giáo viên (Task 5.4):
 * - rời tab (`visibilitychange` → ẩn) và chuyển sang cửa sổ khác (`blur` mà tab vẫn hiện), kèm thời lượng;
 * - copy / paste trên trang (không gửi nội dung).
 * Sự kiện xếp hàng trong localStorage (như đáp án khi mất mạng) và gửi theo lô mỗi 10 s / khi quay lại trang.
 * Không chặn hay làm phiền sinh viên; sinh viên được báo trước ở phòng chờ.
 */
export function useAttemptProctoring(attemptId: string, active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }

    let awayStart: number | null = null;
    let awayHidden = false;
    let flushing = false;

    function enqueue(e: ProctorEvent) {
      writeQueue(attemptId, [...readQueue(attemptId), e]);
    }

    async function flush() {
      if (flushing || !navigator.onLine) {
        return;
      }
      const queue = readQueue(attemptId);
      if (queue.length === 0) {
        return;
      }
      flushing = true;
      const batch = queue.slice(0, BATCH_SIZE);
      try {
        const res = await fetch(`/api/attempts/${attemptId}/events`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...deviceHeaders() },
          body: JSON.stringify({ events: batch }),
          keepalive: true,
        });
        // Đã nhận, hoặc bài không còn làm được / dữ liệu hỏng → bỏ khỏi hàng đợi. 429 / 5xx → gửi lại sau.
        if (res.ok || res.status === 400 || res.status === 403 || res.status === 404 || res.status === 409) {
          writeQueue(attemptId, readQueue(attemptId).slice(batch.length));
        }
      } catch {
        // mất mạng → giữ lại
      } finally {
        flushing = false;
      }
    }

    function startAway(hidden: boolean) {
      if (awayStart === null) {
        awayStart = Date.now();
      }
      awayHidden = awayHidden || hidden;
    }

    function endAway() {
      if (awayStart === null) {
        return;
      }
      const durationMs = Date.now() - awayStart;
      const event: ProctorEvent = {
        type: awayHidden ? 'tab_hidden' : 'window_blur',
        at: new Date(awayStart).toISOString(),
        durationMs,
      };
      awayStart = null;
      awayHidden = false;
      if (durationMs >= MIN_AWAY_MS) {
        enqueue(event);
        void flush();
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        startAway(true);
      } else {
        endAway();
      }
    };
    const onBlur = () => startAway(false);
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        endAway();
      }
    };
    const onCopy = () => enqueue({ type: 'copy', at: new Date().toISOString() });
    const onPaste = () => enqueue({ type: 'paste', at: new Date().toISOString() });
    const onOnline = () => void flush();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    window.addEventListener('online', onOnline);
    const id = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    void flush(); // gửi phần còn lại từ lần mở trước

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      window.removeEventListener('online', onOnline);
      window.clearInterval(id);
      void flush();
    };
  }, [attemptId, active]);
}
