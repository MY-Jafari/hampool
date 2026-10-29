import React from 'react';
import { formatMoney, type FormatMoneyOptions } from '@/shared/lib/format';
import { useLanguage } from '@/shared/providers/LanguageProvider';
import { cn } from '@/shared/lib/utils';

export interface MoneyProps extends FormatMoneyOptions {
  amount: number | string | null | undefined;
  colored?: boolean;
  className?: string;
}

export const Money: React.FC<MoneyProps> = ({
  amount,
  colored = false,
  showUnit = true,
  signDisplay = 'auto',
  className,
}) => {
  const { language } = useLanguage();
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;

  const formatted = formatMoney(amount, {
    locale: language,
    showUnit,
    signDisplay,
  });

  const colorClass = React.useMemo(() => {
    if (!colored) return '';
    if (num > 0) return 'text-owed font-semibold';
    if (num < 0) return 'text-owing font-semibold';
    return 'text-muted-foreground';
  }, [colored, num]);

  return (
    <span dir="ltr" className={cn('inline-flex items-center font-medium', colorClass, className)}>
      {formatted}
    </span>
  );
};
