import type { ButtonHTMLAttributes } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'ghost' | 'danger' | 'solid' | 'ledge';
type Size = 'sm' | 'md' | 'lg';

/**
 * Chalk button (.btn family from the chalkboard design system).
 * - ghost (default): chalk outline        - primary: yellow chalk outline
 * - danger: pink chalk outline            - solid: filled yellow (one main action per screen/modal)
 * - ledge: cream button sitting on the wooden ledge
 */
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Disables the button and marks it busy; pass the "Đang …" label as children. */
  loading?: boolean;
}) {
  const {
    className,
    variant = 'ghost',
    size = 'md',
    type = 'button',
    loading = false,
    disabled,
    ...rest
  } = props;

  const variants = {
    ghost: undefined,
    primary: s.btnPrimary,
    danger: s.btnDanger,
    solid: s.solidBtn,
    ledge: s.ledgeBtn,
  }[variant];

  const sizes = size === 'sm' ? s.btnSm : size === 'lg' ? s.btnLg : undefined;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(s.btn, variants, sizes, className)}
      {...rest}
    />
  );
}
// EOF
