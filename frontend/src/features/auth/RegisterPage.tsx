import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { AuthShell } from '@/features/auth/AuthShell';
import { register, verifyOtp } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/store';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { toastError } from '@/shared/lib/errors';
import { isValidPhone } from '@/shared/lib/formats';
import { cn } from '@/shared/lib/utils';

const detailsSchema = z
  .object({
    phone_number: z
      .string()
      .min(1, 'شماره موبایل را وارد کنید')
      .refine(isValidPhone, 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد'),
    password: z.string().min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد'),
    password_confirm: z.string(),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: 'رمزها یکسان نیستند',
    path: ['password_confirm'],
  });

type DetailsValues = z.infer<typeof detailsSchema>;

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="• • • • • •"
      dir="ltr"
      className="h-12 text-center text-lg font-bold tracking-[0.5em]"
    />
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DetailsValues>({ resolver: zodResolver(detailsSchema), defaultValues: { phone_number: '', password: '', password_confirm: '' } });

  const onSubmitDetails = async (values: DetailsValues) => {
    try {
      const res = await register({
        phone_number: values.phone_number,
        password: values.password,
        password_confirm: values.password_confirm,
      });
      setTempToken(res.temp_token);
      toast.success('کد تایید برای شما ارسال شد.');
    } catch (err) {
      toastError(err);
    }
  };

  const onSubmitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken) return;
    if (otp.length < 6) {
      toast.error('کد تایید باید ۶ رقم باشد.');
      return;
    }
    setVerifying(true);
    try {
      const tokens = await verifyOtp(otp, tempToken);
      setTokens(tokens.access, tokens.refresh);
      toast.success('شماره موبایل شما تایید شد. خوش آمدید 🎉');
      navigate('/', { replace: true });
    } catch (err) {
      toastError(err);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <AuthShell
      title={tempToken ? 'تایید شماره موبایل' : 'ساخت حساب جدید'}
      subtitle={
        tempToken ? 'کد ۶ رقمی ارسال‌شده را وارد کنید' : 'ثبت‌نام با شماره موبایل — فقط چند ثانیه'
      }
      footer={
        <>
          قبلاً حساب ساخته‌اید؟{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            وارد شوید
          </Link>
        </>
      }
    >
      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {[1, 2].map((step) => (
          <div
            key={step}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors',
              (step === 1 && !tempToken) || (step === 2 && tempToken)
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground',
            )}
          >
            {step === 1 ? <Smartphone className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
          </div>
        ))}
        <div className="h-px flex-1 bg-border" />
      </div>

      {!tempToken ? (
        <form onSubmit={handleSubmit(onSubmitDetails)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">شماره موبایل</Label>
            <Input
              id="phone"
              inputMode="numeric"
              placeholder="09xxxxxxxxx"
              dir="ltr"
              className="text-left"
              {...registerField('phone_number')}
            />
            {errors.phone_number && <p className="text-xs text-destructive">{errors.phone_number.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">رمز عبور</Label>
            <Input id="password" type="password" placeholder="حداقل ۸ کاراکتر" {...registerField('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password_confirm">تکرار رمز عبور</Label>
            <Input
              id="password_confirm"
              type="password"
              placeholder="••••••••"
              {...registerField('password_confirm')}
            />
            {errors.password_confirm && (
              <p className="text-xs text-destructive">{errors.password_confirm.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            ثبت‌نام و دریافت کد
          </Button>
        </form>
      ) : (
        <form onSubmit={onSubmitOtp} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="otp">کد تایید</Label>
            <OtpInput value={otp} onChange={setOtp} />
            <p className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                در محیط توسعه، کد تایید در <b dir="ltr">console</b> سرور بک‌اند چاپ می‌شود (در پروداکشن پیامک
                می‌شود).
              </span>
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={verifying}>
            {verifying ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            تایید و ورود
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setTempToken(null);
              setOtp('');
            }}
          >
            بازگشت به اطلاعات ثبت‌نام
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
