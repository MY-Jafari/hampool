import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { normalizeDigits } from '@/shared/lib/format';

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value = '', onChange, error, placeholder = '09123456789', ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const normalized = normalizeDigits(raw).replace(/[^\d]/g, '').slice(0, 11);
      onChange?.(normalized);
    };

    return (
      <div className="relative flex items-center">
        <input
          ref={ref}
          type="tel"
          dir="ltr"
          inputMode="numeric"
          autoComplete="tel"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono tracking-wider ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 text-start',
            error && 'border-destructive focus-visible:ring-destructive',
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
PhoneInput.displayName = 'PhoneInput';
