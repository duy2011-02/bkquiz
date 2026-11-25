import type { HTMLAttributes, TableHTMLAttributes } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { cn } from '@/utils/cn';

/** Horizontal scroll container so wide tables never widen the page. */
export function TableWrap(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div className={cn('bk-table-wrap', className)} {...rest} />;
}

/** Table on the board: yellow chalk headers, dashed chalk rules between rows, Inter body. */
export function Table(props: TableHTMLAttributes<HTMLTableElement>) {
  const { className, ...rest } = props;
  return (
    <table
      className={cn(s.table, 'min-w-full border-separate border-spacing-0 text-left text-sm', className)}
      {...rest}
    />
  );
}
// EOF
