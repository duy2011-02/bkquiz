'use client';

import { useEffect } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { cn } from '@/utils/cn';

type ToastType = 'success' | 'error' | 'info';

type ToastProps = {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
};

/** A small chalkboard (.modal frame + .modalBoard) pinned to the bottom-right corner. */
export function Toast({ message, type = 'info', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const color = {
    success: s.green,
    error: s.pink,
    info: s.blue,
  }[type];

  return (
    <div
      className={cn(s.modal, s.enter, 'fixed right-4 bottom-4 z-toast w-auto max-w-[min(420px,calc(100vw-2rem))] p-1.5')}
      role={type === 'error' ? 'alert' : 'status'}
    >
      <div className={cn(s.modalBoard, s.chalk, color, 'px-4 py-2.5 text-lg')}>
        {message}
      </div>
    </div>
  );
}
