import { normalizeDigits } from './normalizeDigits';

export type AppLocale = 'fa' | 'en';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

function toPersianDigits(str: string): string {
  return str.replace(/\d/g, (d) => {
    const idx = parseInt(d, 10);
    return PERSIAN_DIGITS[idx] ?? d;
  });
}

/**
 * Formats a number or numeric string with thousand grouping separators.
 * For Persian locale: uses Persian digits and '٬' as thousand separator.
 * For English locale: uses Latin digits and ',' as thousand separator.
 */
export function formatNumber(
  value: number | string | null | undefined,
  locale: AppLocale = 'fa',
): string {
  if (value === null || value === undefined || value === '') return locale === 'fa' ? '۰' : '0';
  const cleanStr = normalizeDigits(value).replace(/[^\d.-]/g, '');
  if (!cleanStr) return locale === 'fa' ? '۰' : '0';

  const num = Number(cleanStr);
  if (Number.isNaN(num)) return locale === 'fa' ? '۰' : '0';

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  // Group by thousands with commas
  const parts = absNum.toString().split('.');
  const integerPart = (parts[0] ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'fa' ? '٬' : ',');
  const formatted = parts.length > 1 ? `${integerPart}.${parts[1] ?? ''}` : integerPart;

  if (locale === 'fa') {
    const persianFormatted = toPersianDigits(formatted);
    return isNegative ? `−${persianFormatted}` : persianFormatted;
  }

  return isNegative ? `-${formatted}` : formatted;
}
