import type { HTMLAttributes } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { cn } from '@/utils/cn';

type Variant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/** Dashed chalk tag (.tag); the chalk color carries the meaning, the text always says it. */
export function Badge(props: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  const { className, variant = 'neutral', ...rest } = props;
  const color = {
    neutral: s.dim,
    success: s.green,
    warning: s.yellow,
    danger: s.pink,
    info: s.blue,
  }[variant];

  return (
    <span
      className={cn(s.tag, color, 'font-chalk', className)}
      {...rest}
    />
  );
}
// EOF
