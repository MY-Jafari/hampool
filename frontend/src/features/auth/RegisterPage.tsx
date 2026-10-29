import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Info, Loader2, ShieldCheck, ArrowRight, RotateCw, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import axios from 'axios';
import { AuthShell } from '@/features/auth/AuthShell';
import { register as registerApi, verifyOtp } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/store';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { PhoneInput } from '@/shared/components/ui/phone-input';
import { OtpInput } from '@/shared/components/ui/otp-input';
import { Stepper } from '@/shared/components/ui/stepper';
import { getErrorMessage, getRateLimitWaitSeconds } from '@/shared/lib/errors';
import { normalizeDigits } from '@/shared/lib/format';

export function RegisterPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);

  const [step, setStep] = useState<0 | 1>(0);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [registeredPhone, setRegisteredPhone] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  // Resend timer countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Rate limit countdown
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const interval = setInterval(() => {
      setRateLimitSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitSeconds]);

  const detailsSchema = React.useMemo(
    () =>
      z
        .object({
          phone_number: z
            .string()
            .min(1, t('register.requiredPhone', 'شماره موبایل را وارد کنید'))
            .transform((val) => normalizeDigits(val))
            .refine(
              (val) => /^09\d{9}$/.test(val),
              t('register.invalidPhone', 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد'),
            ),
          password: z
            .string()
            .min(8, t('register.passwordTooShort', 'رمز عبور باید حداقل ۸ کاراکتر باشد')),
          password_confirm: z.string(),
        })
        .refine((data) => data.password === data.password_confirm, {
          message: t('register.passwordsDoNotMatch', 'رمزهای عبور یکسان نیستند'),
          path: ['password_confirm'],
        }),
    [t],
  );

  type DetailsValues = z.infer<typeof detailsSchema>;

  const {
    control,
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { phone_number: '', password: '', password_confirm: '' },
  });

  const onSubmitDetails = async (values: DetailsValues) => {
    if (rateLimitSeconds > 0) return;
    try {
      const res = await registerApi({
        phone_number: values.phone_number,
        password: values.password,
        password_confirm: values.password_confirm,
      });
      setTempToken(res.temp_token);
      setRegisteredPhone(values.phone_number);
      setStep(1);
      setResendCooldown(60);
      toast.success(t('register.success', 'کد تایید برای شما ارسال شد.'));
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 429 || (err.response?.status === 403 && /rate|limit/i.test(JSON.stringify(err.response.data)))) {
          const waitSec = getRateLimitWaitSeconds(err);
          setRateLimitSeconds(waitSec);
          toast.error(t('register.rateLimited', { seconds: waitSec, defaultValue: `تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ${waitSec} ثانیه صبر کنید.` }));
          return;
        }
      }
      toast.error(getErrorMessage(err));
    }
  };

  const onResendCode = async () => {
    if (resendCooldown > 0) return;
    try {
      const values = getValues();
      const res = await registerApi({
        phone_number: values.phone_number,
        password: values.password,
        password_confirm: values.password_confirm,
      });
      setTempToken(res.temp_token);
      setResendCooldown(60);
      toast.success(t('register.success', 'کد تایید جدید برای شما ارسال شد.'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify ?? otpCode;
    if (!tempToken) return;
    if (code.length < 6) {
      toast.error(t('register.otpInvalidLength', 'کد تایید باید ۶ رقم باشد.'));
      return;
    }

    setVerifying(true);
    try {
      const tokens = await verifyOtp(code, tempToken);
      setTokens(tokens.access, tokens.refresh);
      toast.success(t('register.verified', 'شماره موبایل با موفقیت تایید شد. خوش آمدید 🎉'));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  const stepsList = [
    { id: 1, label: t('register.step1', 'اطلاعات حساب') },
    { id: 2, label: t('register.step2', 'کد تایید') },
  ];

  return (
    <AuthShell
      title={step === 0 ? t('register.title', 'ساخت حساب جدید') : t('register.otpTitle', 'تایید شماره موبایل')}
      subtitle={
        step === 0
          ? t('register.subtitle', 'ثبت‌نام با شماره موبایل — فقط چند ثانیه')
          : t('register.otpSubtitle', {
              phone: registeredPhone,
              defaultValue: `کد ۶ رقمی ارسال‌شده به ${registeredPhone} را وارد کنید`,
            })
      }
      footer={
        <>
          {t('register.hasAccount', 'قبلاً ثبت‌نام کرده‌اید؟')}{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            {t('register.loginLink', 'وارد شوید')}
          </Link>
        </>
      }
    >
      <div className="mb-6">
        <Stepper steps={stepsList} currentStep={step} />
      </div>

      {rateLimitSeconds > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning animate-fade-in">
          <AlertCircle className="size-4 shrink-0" />
          <span>
            {t('register.rateLimited', {
              seconds: rateLimitSeconds,
              defaultValue: `تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ${rateLimitSeconds} ثانیه صبر کنید.`,
            })}
          </span>
        </div>
      )}

      {step === 0 ? (
        <form onSubmit={handleSubmit(onSubmitDetails)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t('register.phone', 'شماره موبایل')}</Label>
            <Controller
              name="phone_number"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  id="phone"
                  value={field.value}
                  onChange={field.onChange}
                  error={Boolean(errors.phone_number)}
                  placeholder={t('register.phonePlaceholder', '09123456789')}
                />
              )}
            />
            {errors.phone_number && (
              <p className="text-xs text-destructive animate-fade-in">{errors.phone_number.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{t('register.password', 'رمز عبور')}</Label>
            <div className="relative flex items-center">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('register.passwordPlaceholder', 'حداقل ۸ کاراکتر')}
                error={Boolean(errors.password)}
                className="pe-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label={showPassword ? t('register.hidePassword', 'مخفی کردن') : t('register.showPassword', 'نمایش')}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive animate-fade-in">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password_confirm">{t('register.passwordConfirm', 'تکرار رمز عبور')}</Label>
            <div className="relative flex items-center">
              <Input
                id="password_confirm"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder={t('register.passwordConfirmPlaceholder', '••••••••')}
                error={Boolean(errors.password_confirm)}
                className="pe-10"
                {...register('password_confirm')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute end-3 text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label={showConfirmPassword ? t('register.hidePassword', 'مخفی کردن') : t('register.showPassword', 'نمایش')}
              >
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password_confirm && (
              <p className="text-xs text-destructive animate-fade-in">{errors.password_confirm.message}</p>
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
                <span>{t('register.submitting', 'در حال ارسال...')}</span>
              </>
            ) : (
              <span>{t('register.submit', 'ثبت‌نام و دریافت کد')}</span>
            )}
          </Button>
        </form>
      ) : (
        <div className="space-y-5 animate-fade-in">
          <div className="space-y-2">
            <Label htmlFor="otp" className="text-center block">
              {t('register.otpSubtitle', { phone: registeredPhone })}
            </Label>
            <OtpInput
              value={otpCode}
              onChange={setOtpCode}
              onComplete={(code) => handleVerifyOtp(code)}
              disabled={verifying}
            />

            {/* Dev Hint Banner */}
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <Info className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                {t(
                  'register.otpDevHint',
                  'راهنمای توسعه: کد OTP در کنسول سرور بک‌اند چاپ می‌شود.',
                )}
              </span>
            </div>
          </div>

          <Button
            type="button"
            className="w-full gap-2 font-semibold"
            onClick={() => handleVerifyOtp()}
            disabled={verifying || otpCode.length < 6}
          >
            {verifying ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{t('register.otpVerifying', 'در حال تایید...')}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" />
                <span>{t('register.otpSubmit', 'تایید و ورود به حساب')}</span>
              </>
            )}
          </Button>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={() => {
                setStep(0);
                setOtpCode('');
              }}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowRight className="size-3.5 rtl:rotate-180" />
              <span>{t('register.backToDetails', 'ویرایش اطلاعات و شماره')}</span>
            </button>

            {resendCooldown > 0 ? (
              <span className="text-muted-foreground">
                {t('register.resendIn', { seconds: resendCooldown, defaultValue: `ارسال مجدد تا ${resendCooldown} ثانیه دیگر` })}
              </span>
            ) : (
              <button
                type="button"
                onClick={onResendCode}
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                <RotateCw className="size-3" />
                <span>{t('register.resend', 'ارسال مجدد کد')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </AuthShell>
  );
}
