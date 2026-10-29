import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  normalizeDigits,
  normalizeToNumericString,
} from '../index';

describe('normalizeDigits', () => {
  it('converts Persian digits to Latin digits', () => {
    expect(normalizeDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(normalizeDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
  });

  it('converts Arabic-Indic digits to Latin digits', () => {
    expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('preserves existing Latin digits and letters', () => {
    expect(normalizeDigits('Hello 123')).toBe('Hello 123');
  });

  it('normalizes to pure numeric string', () => {
    expect(normalizeToNumericString('۱۲,۳۴۵ تومان')).toBe('12345');
    expect(normalizeToNumericString('−۵۰٬۰۰۰')).toBe('-50000');
  });
});

describe('formatNumber', () => {
  it('formats Persian numbers with Persian digits and ٬ grouping', () => {
    expect(formatNumber(1000, 'fa')).toBe('۱٬۰۰۰');
    expect(formatNumber(1250000, 'fa')).toBe('۱٬۲۵۰٬۰۰۰');
    expect(formatNumber(0, 'fa')).toBe('۰');
  });

  it('formats English numbers with Latin digits and , grouping', () => {
    expect(formatNumber(1000, 'en')).toBe('1,000');
    expect(formatNumber(1250000, 'en')).toBe('1,250,000');
    expect(formatNumber(0, 'en')).toBe('0');
  });

  it('formats negative numbers correctly', () => {
    expect(formatNumber(-85000, 'fa')).toBe('−۸۵٬۰۰۰');
    expect(formatNumber(-85000, 'en')).toBe('-85,000');
  });
});

describe('formatMoney', () => {
  it('formats money in Toman for Persian locale', () => {
    expect(formatMoney(50000, { locale: 'fa' })).toBe('۵۰٬۰۰۰ تومان');
    expect(formatMoney(-20000, { locale: 'fa' })).toBe('−۲۰٬۰۰۰ تومان');
    expect(formatMoney(0, { locale: 'fa' })).toBe('۰ تومان');
  });

  it('formats money in Toman for English locale', () => {
    expect(formatMoney(50000, { locale: 'en' })).toBe('50,000 Toman');
    expect(formatMoney(-20000, { locale: 'en' })).toBe('-20,000 Toman');
  });

  it('supports signDisplay always', () => {
    expect(formatMoney(50000, { locale: 'fa', signDisplay: 'always' })).toBe('+۵۰٬۰۰۰ تومان');
    expect(formatMoney(50000, { locale: 'en', signDisplay: 'always' })).toBe('+50,000 Toman');
  });

  it('supports hiding unit', () => {
    expect(formatMoney(50000, { locale: 'fa', showUnit: false })).toBe('۵۰٬۰۰۰');
  });
});

describe('formatDate', () => {
  const fixedDate = new Date('2026-08-21T10:00:00Z');

  it('formats Jalali date in fa locale', () => {
    const formatted = formatDate(fixedDate, 'fa');
    // Year 2026 is 1405 in Jalali calendar (1405 or ۱۴۰۵)
    expect(formatted).toMatch(/1405|۱۴۰۵/);
  });

  it('formats Gregorian date in en locale', () => {
    const formatted = formatDate(fixedDate, 'en');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('Aug');
  });

  it('handles invalid date input gracefully', () => {
    expect(formatDate(null, 'fa')).toBe('—');
    expect(formatDate('invalid-date', 'fa')).toBe('—');
  });

  it('formats date and time', () => {
    const formattedFa = formatDateTime(fixedDate, 'fa');
    expect(formattedFa).toMatch(/1405|۱۴۰۵/);
    const formattedEn = formatDateTime(fixedDate, 'en');
    expect(formattedEn).toContain('2026');
  });
});
