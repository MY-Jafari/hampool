/** Format a number with Persian digits and thousand separators. */
export function formatNumber(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '۰';
  return n.toLocaleString('fa-IR');
}

/** Format an amount as toman. */
export function formatToman(value: number | string): string {
  return `${formatNumber(value)} تومان`;
}

/** Compact format (thousands) — e.g. ۱٫۲ میلیون. */
export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} میلیون`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(value / 1_000)} هزار`;
  }
  return formatNumber(value);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fa-IR', { day: 'numeric', month: 'short' }) +
    '، ' +
    d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

export function isValidPhone(value: string): boolean {
  return /^09\d{9}$/.test(value);
}

export const splitTypeLabel: Record<string, string> = {
  equal: 'مساوی',
  exact: 'دقیق',
  percentage: 'درصدی',
  itemized: 'آیتمی',
};

export const settlementStatusLabel: Record<string, string> = {
  pending: 'در انتظار',
  confirmed: 'تایید شده',
  reversed: 'ابطال شده',
};

export const roleLabel: Record<string, string> = {
  admin: 'مدیر',
  member: 'عضو',
};

const activityActionLabel: Record<string, string> = {
  group_created: 'گروه ساخته شد',
  member_joined: 'عضو پیوست',
  member_left: 'عضو خارج شد',
  member_role_changed: 'نقش عضو تغییر کرد',
  expense_created: 'هزینه ثبت شد',
  expense_confirmed: 'هزینه تایید شد',
  expense_deleted: 'هزینه حذف شد',
  settlement_created: 'تسویه ایجاد شد',
  settlement_confirmed: 'تسویه تایید شد',
  settlement_reversed: 'تسویه ابطال شد',
};

export function activityLabel(action: string): string {
  return activityActionLabel[action] ?? action;
}

/** Build a human-readable Persian notification from a WS group event. */
export function notifyText(eventType: string, params: Record<string, unknown>): string {
  const p = params as Record<string, string | number | undefined>;
  const amount = formatToman(Number(p.amount ?? 0));
  const who = (p.payer ?? p.phone_number ?? p.from_phone ?? '') as string;
  const description = p.description ? `«${String(p.description)}»` : '';

  switch (eventType) {
    case 'group_created':
      return 'گروه جدیدی ساخته شد.';
    case 'member_joined':
      return `${who || 'یک نفر'} به گروه پیوست.`;
    case 'member_left':
      return `${who || 'یک نفر'} از گروه خارج شد.`;
    case 'member_role_changed':
      return 'نقش یکی از اعضا تغییر کرد.';
    case 'expense_created':
      return `هزینهٔ ${description} به مبلغ ${amount} ثبت شد.`;
    case 'expense_confirmed':
      return `هزینهٔ ${description} تایید شد.`;
    case 'expense_deleted':
      return `هزینهٔ ${description} حذف شد.`;
    case 'settlement_created':
      return `تسویهٔ ${amount} ایجاد شد.`;
    case 'settlement_confirmed':
      return `تسویهٔ ${amount} تایید شد.`;
    case 'settlement_reversed':
      return `تسویهٔ ${amount} ابطال شد.`;
    default:
      return 'رویداد جدیدی در گروه رخ داد.';
  }
}
