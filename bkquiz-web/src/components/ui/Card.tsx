import type { HTMLAttributes } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { cn } from '@/utils/cn';

type Variant = 'board' | 'note' | 'plain';

/**
 * Surfaces written on the board:
 * - board (default): a chalk-drawn box (the .option frame)
 * - note: dashed callout (.note) in the current text color
 * - plain: the noise-free .modalBoard surface, for dense tables and long forms
 */
export function Card(props: HTMLAttributes<HTMLDivElement> & { interactive?: boolean; variant?: Variant }) {
  const {
    className,
    interactive = false,
    variant = 'board',
    ...rest
  } = props;

  const base = {
    board: s.box,
    note: cn(s.note, 'relative'),
    plain: s.slate,
  }[variant];

  return (
    <div
      className={cn(base, interactive && variant === 'board' && s.boxInteractive, className)}
      {...rest}
    />
  );
}
// EOF
