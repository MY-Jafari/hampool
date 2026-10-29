import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { normalizeDigits } from '@/shared/lib/format';
import { useLanguage } from '@/shared/providers/LanguageProvider';

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: number | string;
  onChange?: (val: number) => void;
  error?: boolean;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, value, onChange, error, placeholder = '0', ...props }, ref) => {
    const { language } = useLanguage();

    const formatDisplay = (numVal: number | string | undefined): string => {
      if (numVal === undefined || numVal === null || numVal === '') return '';
      const clean = normalizeDigits(numVal).replace(/[^\d]/g, '');
      if (!clean) return '';
      return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    const [displayVal, setDisplayVal] = React.useState<string>(() => formatDisplay(value));

    React.useEffect(() => {
      setDisplayVal(formatDisplay(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const clean = normalizeDigits(raw).replace(/[^\d]/g, '');
      const parsed = clean ? parseInt(clean, 10) : 0;
      setDisplayVal(clean.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
      onChange?.(parsed);
    };

    return (
      <div className="relative flex items-center w-full">
        <input
          ref={ref}
          type="text"
          dir="ltr"
          inputMode="numeric"
          value={displayVal}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            'flex h-10 w-full rounded-lg border border-input bg-background ps-3 pe-14 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 text-start',
            error && 'border-destructive focus-visible:ring-destructive',
            className,
          )}
          {...props}
        />
        <div className="pointer-events-none absolute end-3 flex items-center text-xs text-muted-foreground select-none">
          {language === 'fa' ? 'تومان' : 'Toman'}
        </div>
      </div>
    );
  },
);
MoneyInput.displayName = 'MoneyInput';
