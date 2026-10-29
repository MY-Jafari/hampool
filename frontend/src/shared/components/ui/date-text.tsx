import React from 'react';
import { formatDate, formatDateTime, formatRelative } from '@/shared/lib/format';
import { useLanguage } from '@/shared/providers/LanguageProvider';

export interface DateTextProps {
  date: string | number | Date | null | undefined;
  withTime?: boolean;
  relative?: boolean;
  className?: string;
}

export const DateText: React.FC<DateTextProps> = ({
  date,
  withTime = false,
  relative = false,
  className = '',
}) => {
  const { language } = useLanguage();

  if (!date) return <span className={className}>—</span>;

  let text: string;
  if (relative) {
    text = formatRelative(date, language);
  } else if (withTime) {
    text = formatDateTime(date, language);
  } else {
    text = formatDate(date, language);
  }

  const fullDateTime = formatDateTime(date, language);

  return (
    <time
      dateTime={typeof date === 'string' ? date : undefined}
      title={fullDateTime}
      className={`inline-block ${className}`}
    >
      {text}
    </time>
  );
};
