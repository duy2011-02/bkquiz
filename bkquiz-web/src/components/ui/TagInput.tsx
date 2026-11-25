'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldHint, Input } from '@/components/ui/Input';

type TagInputProps = {
  value: string; // Comma-separated string
  onChange: (value: string) => void;
  onSave?: () => void;
  tags?: Array<{ id: string; name: string; normalizedName: string }>;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  showSaveButton?: boolean;
};

export function TagInput({
  value,
  onChange,
  onSave,
  tags = [],
  placeholder = 'tag1, tag2, tag3...',
  maxLength = 200,
  disabled = false,
  showSaveButton = false,
}: TagInputProps) {
  const t = useTranslations('TagInput');
  return (
    <div className="space-y-2">
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
      />

      {/* Hiển thị tags hiện có */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <Badge key={tag.id} variant="neutral">
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      <FieldHint>
        {t('hint')}
      </FieldHint>

      {showSaveButton && onSave && (
        <Button variant="primary" size="sm" onClick={onSave} disabled={disabled}>
          {t('save')}
        </Button>
      )}
    </div>
  );
}
