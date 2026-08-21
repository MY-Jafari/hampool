import axios from 'axios';
import { toast } from 'sonner';

type ErrorData = Record<string, unknown>;

function firstError(data: ErrorData): string | null {
  for (const value of Object.values(data)) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.length > 0) return String(value[0]);
  }
  return null;
}

/** Convert any thrown value into a friendly Persian message. */
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'ارتباط با سرور برقرار نشد.';
    const status = err.response.status;
    const data = (err.response.data ?? {}) as ErrorData;

    if (status === 401) return 'نشست شما منقضی شده است؛ دوباره وارد شوید.';
    if (status === 403) {
      const msg = firstError(data);
      // django-ratelimit surfaces as 403
      if (msg && /rate|too many|limit/i.test(msg)) {
        return 'درخواست‌های زیادی ارسال کردید؛ کمی صبر کنید و دوباره تلاش کنید.';
      }
      return msg ?? 'شما اجازه انجام این کار را ندارید.';
    }
    if (status === 404) return 'مورد درخواستی پیدا نشد.';
    if (status === 409) return 'داده‌ها تغییر کرده‌اند؛ لطفاً دوباره تلاش کنید.';
    if (status === 429) return 'درخواست‌های زیادی ارسال کردید؛ کمی صبر کنید.';
    if (status === 503) return 'سرویس موقتاً در دسترس نیست؛ بعداً تلاش کنید.';

    return firstError(data) ?? 'خطای ناشناخته‌ای رخ داد.';
  }
  if (err instanceof Error) return err.message;
  return 'خطای ناشناخته‌ای رخ داد.';
}

export function toastError(err: unknown): void {
  toast.error(getErrorMessage(err));
}
