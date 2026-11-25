import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

/** Loading placeholder: a chalk track with an eraser smudge sweeping across ("wiping the board"). */
export function Skeleton(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return (
    <div
      aria-hidden="true"
      className={cn('bk-skeleton', className)}
      {...rest}
    />
  );
}
// EOF
