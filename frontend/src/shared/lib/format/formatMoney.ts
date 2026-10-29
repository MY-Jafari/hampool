import { formatNumber, type AppLocale } from './formatNumber';
import { normalizeDigits } from './normalizeDigits';

export interface FormatMoneyOptions {
  locale?: AppLocale;
  showUnit?: boolean;
  signDisplay?: 'auto' | 'always' | 'never';
}

/**
 * Formats a monetary amount in Tomans (1 Toman = 1 Toman, no currency conversion).
 * In fa: "۱۲۳٬۴۵۶ تومان" (or with sign: "+۱۲۳٬۴۵۶ تومان", "−۱۲۳٬۴۵۶ تومان").
 * In en: "123,456 Toman" (or with sign: "+123,456 Toman", "-123,456 Toman").
 */
export function formatMoney(
  amount: number | string | null | undefined,
  options: FormatMoneyOptions = {},
): string {
  const { locale = 'fa', showUnit = true, signDisplay = 'auto' } = options;

  if (amount === null || amount === undefined || amount === '') {
    const zero = locale === 'fa' ? '۰' : '0';
    const unit = showUnit ? (locale === 'fa' ? ' تومان' : ' Toman') : '';
    return `${zero}${unit}`;
  }

  const clean = normalizeDigits(amount).replace(/[^\d.-]/g, '');
  const num = Number(clean);
  if (Number.isNaN(num)) {
    const zero = locale === 'fa' ? '۰' : '0';
    const unit = showUnit ? (locale === 'fa' ? ' تومان' : ' Toman') : '';
    return `${zero}${unit}`;
  }

  const isPositive = num > 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const baseNumber = formatNumber(absNum, locale);

  let prefix = '';
  if (isNegative) {
    prefix = locale === 'fa' ? '−' : '-';
  } else if (isPositive && signDisplay === 'always') {
    prefix = '+';
  }

  const unit = showUnit ? (locale === 'fa' ? ' تومان' : ' Toman') : '';
  return `${prefix}${baseNumber}${unit}`;
}
