import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { normalizeDigits } from '@/shared/lib/format';

export interface OtpInputProps {
  length?: number;
  value?: string;
  onChange?: (val: string) => void;
  onComplete?: (val: string) => void;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value = '',
  onChange,
  onComplete,
  disabled = false,
  error = false,
  className,
}) => {
  const inputsRef = React.useRef<(HTMLInputElement | null)[]>([]);

  const digits = React.useMemo(() => {
    const arr = value.split('').slice(0, length);
    while (arr.length < length) arr.push('');
    return arr;
  }, [value, length]);

  const setDigit = (idx: number, char: string) => {
    const clean = normalizeDigits(char).replace(/[^\d]/g, '');
    const newDigits = [...digits];
    newDigits[idx] = clean.slice(-1);
    const combined = newDigits.join('');
    onChange?.(combined);
    if (combined.length === length && !newDigits.includes('')) {
      onComplete?.(combined);
    }
  };

  const handleChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      setDigit(idx, '');
      return;
    }
    setDigit(idx, val);
    if (idx < length - 1 && val) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = normalizeDigits(e.clipboardData.getData('text')).replace(/[^\d]/g, '').slice(0, length);
    if (!pasted) return;
    onChange?.(pasted);
    const nextIdx = Math.min(pasted.length, length - 1);
    inputsRef.current[nextIdx]?.focus();
    if (pasted.length === length) {
      onComplete?.(pasted);
    }
  };

  return (
    <div dir="ltr" className={cn('flex items-center justify-center gap-2 sm:gap-3', className)}>
      {Array.from({ length }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputsRef.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[idx] || ''}
          onChange={(e) => handleChange(idx, e)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={cn(
            'size-11 sm:size-12 text-center text-lg sm:text-xl font-bold font-mono rounded-xl border border-input bg-card shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50',
            error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
            digits[idx] && 'border-primary/60 bg-primary/5',
          )}
        />
      ))}
    </div>
  );
};
