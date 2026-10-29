/**
 * Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits to standard Latin (0-9) digits.
 * Strips out thousands separators (٬ and ,) when normalizing numeric inputs.
 */
export function normalizeDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  const str = String(input);

  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (!char) continue;
    if (char === '−') {
      result += '-';
      continue;
    }
    const pIdx = persianDigits.indexOf(char);
    if (pIdx !== -1) {
      result += pIdx;
      continue;
    }
    const aIdx = arabicDigits.indexOf(char);
    if (aIdx !== -1) {
      result += aIdx;
      continue;
    }
    result += char;
  }
  return result;
}

/**
 * Normalizes input to digits only (stripping non-numeric characters except optional leading negative sign).
 */
export function normalizeToNumericString(input: string | number | null | undefined): string {
  const normalized = normalizeDigits(input);
  return normalized.replace(/[^\d-]/g, '');
}
