import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, LogIn, AlertCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import axios from 'axios';
import { AuthShell } from '@/features/auth/AuthShell';
import { login } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/store';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { PhoneInput } from '@/shared/components/ui/phone-input';
import { getErrorMessage, getRateLimitWaitSeconds } from '@/shared/lib/errors';
import { normalizeDigits } from '@/shared/lib/format';

export function LoginPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const setTokens = useAuthStore((s) => s.setTokens);

  const [showPassword, setShowPassword] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  // Rate limit countdown effect
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const timer = setInterval(() => {
      setRateLimitSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  const schema = React.useMemo(
    () =>
      z.object({
        phone_number: z
          .string()
          .min(1, t('login.requiredPhone', 'شماره موبایل را وارد کنید'))
          .transform((val) => normalizeDigits(val))
          .refine(
            (val) => /^09\d{9}$/.test(val),
            t('login.invalidPhone', 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد'),
          ),
        password: z.string().min(1, t('login.requiredPassword', 'رمز عبور را وارد کنید')),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone_number: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    if (rateLimitSeconds > 0) return;
    try {
      const tokens = await login(values.phone_number, values.password);
      setTokens(tokens.access, tokens.refresh);
      toast.success(t('login.welcome', 'خوش آمدید 👋'));
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/dashboard', { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 429 || (err.response?.status === 403 && /rate|limit/i.test(JSON.stringify(err.response.data)))) {
          const waitSec = getRateLimitWaitSeconds(err);
          setRateLimitSeconds(waitSec);
          toast.error(t('login.rateLimited', { seconds: waitSec, defaultValue: `تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ${waitSec} ثانیه صبر کنید.` }));
          return;
        }
        if (err.response?.status === 401) {
          toast.error(t('login.invalidCredentials', 'شماره موبایل یا رمز عبور اشتباه است.'));
          return;
        }
      }
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <AuthShell
      title={t('login.title', 'ورود به حساب')}
      subtitle={t('login.subtitle', 'با شماره موبایل و رمز عبور وارد شوید')}
      footer={
        <>
          {t('login.noAccount', 'حساب کاربری ندارید؟')}{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            {t('login.registerLink', 'ثبت‌نام کنید')}
          </Link>
        </>
      }
    >
      {rateLimitSeconds > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning animate-fade-in">
          <AlertCircle className="size-4 shrink-0" />
          <span>
            {t('login.rateLimited', {
              seconds: rateLimitSeconds,
              defaultValue: `تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ${rateLimitSeconds} ثانیه صبر کنید.`,
            })}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="phone">{t('login.phone', 'شماره موبایل')}</Label>
          <Controller
            name="phone_number"
            control={control}
            render={({ field }) => (
              <PhoneInput
                id="phone"
                value={field.value}
                onChange={field.onChange}
                error={Boolean(errors.phone_number)}
                placeholder={t('login.phonePlaceholder', '09123456789')}
              />
            )}
          />
          {errors.phone_number && (
            <p className="text-xs text-destructive animate-fade-in">{errors.phone_number.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">{t('login.password', 'رمز عبور')}</Label>
          <div className="relative flex items-center">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('login.passwordPlaceholder', '••••••••')}
              error={Boolean(errors.password)}
              className="pe-10"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute end-3 text-muted-foreground hover:text-foreground focus:outline-none"
              aria-label={showPassword ? t('login.hidePassword', 'مخفی کردن') : t('login.showPassword', 'نمایش')}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive animate-fade-in">{errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full gap-2 font-semibold"
          disabled={isSubmitting || rateLimitSeconds > 0}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>{t('login.submitting', 'در حال ورود...')}</span>
            </>
          ) : (
            <>
              <LogIn className="size-4" />
              <span>
                {rateLimitSeconds > 0
                  ? `${rateLimitSeconds}s`
                  : t('login.submit', 'ورود به حساب')}
              </span>
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
