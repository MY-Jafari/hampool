import type { AppLocale } from './formatNumber';

function parseDate(input: string | number | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a date string, timestamp, or Date object into localized Jalali (fa) or Gregorian (en).
 */
export function formatDate(
  dateInput: string | number | Date | null | undefined,
  locale: AppLocale = 'fa',
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = parseDate(dateInput);
  if (!date) return '—';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };

  try {
    const intlLocale = locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-US';
    return new Intl.DateTimeFormat(intlLocale, defaultOptions).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * Formats a date with time (hour:minute).
 */
export function formatDateTime(
  dateInput: string | number | Date | null | undefined,
  locale: AppLocale = 'fa',
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = parseDate(dateInput);
  if (!date) return '—';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  try {
    const intlLocale = locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-US';
    return new Intl.DateTimeFormat(intlLocale, defaultOptions).format(date);
  } catch {
    return date.toLocaleString();
  }
}

/**
 * Formats relative time (e.g. "۵ دقیقه پیش", "yesterday", etc.).
 */
export function formatRelative(
  dateInput: string | number | Date | null | undefined,
  locale: AppLocale = 'fa',
): string {
  const date = parseDate(dateInput);
  if (!date) return '—';

  const now = Date.now();
  const diffSec = Math.round((date.getTime() - now) / 1000);
  const absSec = Math.abs(diffSec);

  const rtf = new Intl.RelativeTimeFormat(locale === 'fa' ? 'fa-IR' : 'en', {
    numeric: 'auto',
  });

  if (absSec < 60) {
    return rtf.format(diffSec, 'second');
  }
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, 'minute');
  }
  const diffHours = Math.round(diffMin / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, 'day');
  }
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, 'month');
  }
  const diffYears = Math.round(diffDays / 365);
  return rtf.format(diffYears, 'year');
}
