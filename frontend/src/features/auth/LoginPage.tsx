import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, LogIn } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { AuthShell } from '@/features/auth/AuthShell';
import { login } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/store';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { toastError } from '@/shared/lib/errors';
import { isValidPhone } from '@/shared/lib/formats';

const schema = z.object({
  phone_number: z
    .string()
    .min(1, 'شماره موبایل را وارد کنید')
    .refine(isValidPhone, 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد'),
  password: z.string().min(1, 'رمز عبور را وارد کنید'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setTokens = useAuthStore((s) => s.setTokens);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { phone_number: '', password: '' } });

  const onSubmit = async (values: FormValues) => {
    try {
      const tokens = await login(values.phone_number, values.password);
      setTokens(tokens.access, tokens.refresh);
      toast.success('خوش آمدید 👋');
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/', { replace: true });
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <AuthShell
      title="ورود به حساب"
      subtitle="با شماره موبایل و رمز عبور وارد شوید"
      footer={
        <>
          حساب ندارید؟{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            ثبت‌نام کنید
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="phone">شماره موبایل</Label>
          <Input
            id="phone"
            inputMode="numeric"
            placeholder="09xxxxxxxxx"
            dir="ltr"
            className="text-left"
            {...register('phone_number')}
          />
          {errors.phone_number && (
            <p className="text-xs text-destructive">{errors.phone_number.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">رمز عبور</Label>
          <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          ورود
        </Button>
      </form>
    </AuthShell>
  );
}
