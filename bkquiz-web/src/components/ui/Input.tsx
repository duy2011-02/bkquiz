import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { cn } from '@/utils/cn';

/** Paper text field (the .tokenInput paper box, in Inter, left-aligned). */
export const Input = ({ ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: React.RefObject<HTMLInputElement | null> }) => {
  const { className, ...rest } = props;
  return <input ref={ref} className={cn(s.field, className)} {...rest} />;
};

Input.displayName = 'Input';

export const Textarea = ({ ref, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.RefObject<HTMLTextAreaElement | null> }) => {
  const { className, ...rest } = props;
  return <textarea ref={ref} className={cn(s.field, className)} {...rest} />;
};

Textarea.displayName = 'Textarea';

export const Select = ({ ref, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { ref?: React.RefObject<HTMLSelectElement | null> }) => {
  const { className, ...rest } = props;
  return <select ref={ref} className={cn(s.field, className)} {...rest} />;
};

Select.displayName = 'Select';

/** Chalk label above a field (.inputLabel). */
export function FieldLabel(props: React.LabelHTMLAttributes<HTMLLabelElement>) {
  const { className, ...rest } = props;
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label className={cn(s.inputLabel, className)} {...rest} />;
}

/** Hint under a field (.inputHint). */
export function FieldHint(props: React.HTMLAttributes<HTMLParagraphElement>) {
  const { className, ...rest } = props;
  return <p className={cn(s.inputHint, className)} {...rest} />;
}
// EOF
