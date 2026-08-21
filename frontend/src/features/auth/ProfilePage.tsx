import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Loader2, LogOut, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { logout, updateProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/store';
import { useProfile } from '@/features/auth/useProfile';
import { PageHeader } from '@/shared/components/PageHeader';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { toastError } from '@/shared/lib/errors';

const schema = z.object({
  full_name: z.string().min(1, 'نام را وارد کنید'),
  email: z.union([z.literal(''), z.string().email('ایمیل معتبر نیست')]),
  language: z.enum(['fa', 'en']),
});

type FormValues = z.infer<typeof schema>;

export function ProfilePage() {
  const navigate = useNavigate();
  const { data: user, isLoading, refetch } = useProfile();
  const setUser = useAuthStore((s) => s.setUser);
  const refresh = useAuthStore((s) => s.refresh);
  const clear = useAuthStore((s) => s.clear);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (user) {
      reset({ full_name: user.full_name || '', email: user.email ?? '', language: user.language });
    }
  }, [user, reset]);

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const form = new FormData();
      form.append('full_name', values.full_name);
      if (values.email) form.append('email', values.email);
      form.append('language', values.language);
      if (avatarFile) form.append('avatar', avatarFile);
      const updated = await updateProfile(form);
      setUser(updated);
      toast.success('پروفایل به‌روزرسانی شد.');
      await refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      if (refresh) await logout(refresh);
    } catch {
      // ignore
    }
    clear();
    toast.success('با موفقیت خارج شدید.');
    navigate('/login', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="پروفایل" description="اطلاعات حساب خود را مدیریت کنید" />

      <Card>
        <CardContent className="p-6">
          <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative">
              <Avatar className="size-20 border-2 border-border">
                <AvatarImage src={avatarPreview ?? user?.avatar ?? undefined} />
                <AvatarFallback className="text-2xl">
                  {(user?.full_name || user?.phone_number || '؟').slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute -bottom-1 -left-1 flex size-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-transform hover:scale-105"
              >
                <Camera className="size-3.5" />
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAvatarChange}
              />
            </div>
            <div className="text-center sm:text-right">
              <p className="font-semibold">{user?.full_name || 'کاربر'}</p>
              <p className="text-sm text-muted-foreground" dir="ltr">
                {user?.phone_number}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">عضو از {new Date(user?.date_joined ?? '').toLocaleDateString('fa-IR')}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">نام و نام خانوادگی</Label>
              <Input id="full_name" placeholder="مثلاً علی محمدی" {...register('full_name')} />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">ایمیل</Label>
              <Input id="email" type="email" dir="ltr" className="text-left" placeholder="you@example.com" {...register('email')} />
              <p className="text-xs text-muted-foreground">برای دریافت گزارش‌های PDF لازم است.</p>
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>زبان</Label>
              <Select
                defaultValue={user?.language ?? 'fa'}
                onValueChange={(v) => setValue('language', v as 'fa' | 'en')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fa">فارسی</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                ذخیره تغییرات
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="text-sm font-semibold">خروج از حساب</p>
            <p className="text-xs text-muted-foreground">توکن‌های شما بلاک‌لیست و حذف می‌شوند.</p>
          </div>
          <Button variant="destructive" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            خروج
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
