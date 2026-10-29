import axios from 'axios';
import { toast } from 'sonner';
import i18n from '@/shared/lib/i18n';

type ErrorData = Record<string, unknown>;

function firstError(data: ErrorData): string | null {
  for (const value of Object.values(data)) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.length > 0) return String(value[0]);
  }
  return null;
}

/**
 * Extracts rate-limit cooldown seconds if available from headers or defaults to 60.
 */
export function getRateLimitWaitSeconds(err: unknown): number {
  if (axios.isAxiosError(err)) {
    const retryHeader = err.response?.headers?.['retry-after'];
    if (retryHeader) {
      const parsed = parseInt(String(retryHeader), 10);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  return 60;
}

/**
 * Converts any thrown error or API failure into a localized user-friendly message.
 */
export function getErrorMessage(err: unknown): string {
  const isEn = i18n.language?.startsWith('en');

  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return isEn
        ? 'Could not connect to the server. Check your network connection.'
        : 'ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت خود را بررسی کنید.';
    }

    const status = err.response.status;
    const data = (err.response.data ?? {}) as ErrorData;

    if (status === 401) {
      return isEn
        ? 'Your session has expired. Please sign in again.'
        : 'نشست شما منقضی شده است؛ لطفاً دوباره وارد شوید.';
    }

    if (status === 403) {
      const msg = firstError(data);
      if (msg && /rate|too many|limit|throttle/i.test(msg)) {
        return isEn
          ? 'Too many requests. Please wait a moment and try again.'
          : 'درخواست‌های زیادی ارسال کردید؛ کمی صبر کنید و دوباره تلاش کنید.';
      }
      return msg ?? (isEn ? 'You do not have permission to perform this action.' : 'شما اجازه انجام این کار را ندارید.');
    }

    if (status === 404) {
      return isEn ? 'The requested resource was not found.' : 'مورد درخواستی پیدا نشد.';
    }

    if (status === 409) {
      const msg = firstError(data);
      return msg ?? (isEn ? 'Data has changed. Please refresh and try again.' : 'داده‌ها تغییر کرده‌اند؛ لطفاً دوباره تلاش کنید.');
    }

    if (status === 429) {
      return isEn
        ? 'Rate limit exceeded. Please wait a moment before trying again.'
        : 'درخواست‌های بیش از حد مجاز؛ لطفاً کمی صبر کنید.';
    }

    if (status === 503) {
      return isEn
        ? 'Service is temporarily unavailable. Please try again later.'
        : 'سرویس موقتاً در دسترس نیست؛ بعداً تلاش کنید.';
    }

    const customMsg = firstError(data);
    if (customMsg) return customMsg;

    return isEn ? 'An unexpected error occurred.' : 'خطای ناشناخته‌ای رخ داد.';
  }

  if (err instanceof Error) return err.message;
  return isEn ? 'An unexpected error occurred.' : 'خطای ناشناخته‌ای رخ داد.';
}

export function toastError(err: unknown): void {
  toast.error(getErrorMessage(err));
}
