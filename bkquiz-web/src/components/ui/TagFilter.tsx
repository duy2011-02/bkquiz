'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type TagFilterProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
};

export function TagFilter({
  value,
  onChange,
  onClear,
  placeholder,
}: TagFilterProps) {
  const t = useTranslations('TagFilter');
  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? t('placeholder')}
        aria-label={placeholder ?? t('placeholder')}
        className="flex-1"
      />
      {value && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          {t('clear')}
        </Button>
      )}
    </div>
  );
}
