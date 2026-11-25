import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import s from './chalk.module.css';

/**
 * Full chalkboard: cream wall (.room), wooden frame (.frame), green board (.board)
 * and the chalk ledge (.ledge) at the bottom.
 *
 * - `lockViewport`: on desktop the board fills exactly one screen (attempt, projector).
 *   Otherwise the board grows with its content and the page scrolls (dashboard).
 * - `ledge`: page-level actions sitting on the wooden tray under the board.
 */
export function ChalkRoom(props: {
  children: ReactNode;
  ledge?: ReactNode;
  lockViewport?: boolean;
  className?: string;
  innerClassName?: string;
}) {
  const { children, ledge, lockViewport = false, className, innerClassName } = props;
  return (
    <div className={cn(s.room, lockViewport && s.roomLocked, className)}>
      <div className={cn(s.frame, lockViewport && s.frameLocked)}>
        <div className={s.board}>
          <div className={cn(s.boardInner, innerClassName)}>{children}</div>
        </div>
        <div className={s.ledge}>{ledge}</div>
      </div>
    </div>
  );
}
