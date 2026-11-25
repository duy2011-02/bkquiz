'use client';

import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { cn } from '@/utils/cn';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type ModalProps = {
  open: boolean;
  /** Called on Escape / backdrop click when `dismissible`. */
  onClose?: () => void;
  title: ReactNode;
  /** Rendered above the title (e.g. the .modalIcon of the checkpoint gate). */
  icon?: ReactNode;
  children?: ReactNode;
  /** Buttons row, rendered in a `.actions` row under a chalk rule. */
  footer?: ReactNode;
  /** false: Escape and backdrop clicks do nothing (e.g. the checkpoint gate). */
  dismissible?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** center (default) or left: full-height drawer sliding from the left edge (mobile navigation). */
  placement?: 'center' | 'left';
  titleClassName?: string;
  className?: string;
};

/**
 * Small chalkboard modal: .overlay > .modal (wooden frame) > .modalBoard.
 * Traps keyboard focus inside and restores it to the opener when closed.
 */
export function Modal(props: ModalProps) {
  const { open, onClose, title, icon, children, footer, dismissible = true, size = 'md', placement = 'center', titleClassName, className } = props;
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const opener = document.activeElement as HTMLElement | null;
    const box = boxRef.current;
    if (box) {
      // Use data-autofocus (not React autoFocus) so the opener is captured before focus moves
      const autofocus = box.querySelector<HTMLElement>('[data-autofocus]');
      const first = autofocus ?? box.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? box).focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !boxRef.current) {
        return;
      }
      const items = Array.from(boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, [open, dismissible]);

  if (!open) {
    return null;
  }

  const maxWidth = { sm: 'max-w-sm', md: undefined, lg: 'max-w-2xl', xl: 'max-w-6xl' }[size];
  const isDrawer = placement === 'left';

  return (
    // Backdrop click is a mouse convenience only; keyboard users close with Escape (handled above)
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className={cn(s.overlay, isDrawer && 'items-stretch justify-start p-0')}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className={cn(s.modal, maxWidth, isDrawer && cn(s.enterLeft, 'flex max-w-[300px] rounded-l-none'))}>
        <div
          ref={boxRef}
          tabIndex={-1}
          className={cn(s.modalBoard, 'overflow-y-auto outline-none', isDrawer ? 'w-full' : 'max-h-[85dvh]', className)}
        >
          {icon}
          <h2 id={titleId} className={cn(s.modalTitle, s.chalk, titleClassName)}>{title}</h2>
          {children}
          {footer && (
            <>
              <div className={s.rule} />
              <div className={cn(s.actions, 'justify-end')}>{footer}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
