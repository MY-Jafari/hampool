import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Camera,
  Globe,
  Loader2,
  LogOut,
  Moon,
  Save,
  Sun,
  SunMoon,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { logout, updateProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/store';
import { useProfile } from '@/features/auth/useProfile';
import { PageHeader } from '@/shared/components/PageHeader';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { toastError } from '@/shared/lib/errors';
import { formatDate } from '@/shared/lib/format';
import { useLanguage } from '@/shared/providers/LanguageProvider';
import { useTheme } from '@/shared/providers/ThemeProvider';

export function ProfilePage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const { setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  const profileSchema = useMemo(
    () =>
      z.object({
        full_name: z.string().min(1, t('profile.fullNameRequired')),
        email: z.union([
          z.literal(''),
          z.string().email(t('profile.emailInvalid')),
        ]),
        language: z.enum(['fa', 'en']),
      }),
    [t],
  );

  type FormValues = z.infer<typeof profileSchema>;

  const { data: user, isLoading, refetch } = useProfile();
  const setUser = useAuthStore((s) => s.setUser);
  const refresh = useAuthStore((s) => s.refresh);
  const clear = useAuthStore((s) => s.clear);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      email: '',
      language: 'fa',
    },
  });

  const selectedLanguage = watch('language');

  useEffect(() => {
    if (user) {
      reset({
        full_name: user.full_name || '',
        email: user.email ?? '',
        language: user.language ?? 'fa',
      });
    }
  }, [user, reset]);

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
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

      // Sync active language immediately
      if (values.language) {
        setLanguage(values.language);
      }

      toast.success(t('profile.saved'));
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
      if (refresh) {
        await logout(refresh);
      }
    } catch {
      // ignore server failure on logout
    } finally {
      clear();
      toast.success(t('profile.loggedOut'));
      navigate('/login', { replace: true });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="size-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
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
      <PageHeader
        title={t('profile.title')}
        description={t('profile.subtitle')}
      />

      {/* ── Profile Info & Form Card ─────────────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          {/* Avatar & Header */}
          <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative">
              <Avatar className="size-20 border-2 border-border shadow-sm">
                <AvatarImage src={avatarPreview ?? user?.avatar ?? undefined} />
                <AvatarFallback className="text-2xl font-bold">
                  {(user?.full_name || user?.phone_number || '؟').slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute -bottom-1 -start-1 flex size-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-transform hover:scale-105"
                title={t('profile.changeAvatar')}
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

            <div className="text-center sm:text-start">
              <p className="text-lg font-semibold">{user?.full_name || t('profile.title')}</p>
              <p className="text-sm text-muted-foreground" dir="ltr">
                {user?.phone_number}
              </p>
              {user?.date_joined && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('profile.memberSince', { date: formatDate(user.date_joined) })}
                </p>
              )}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">{t('profile.fullName')}</Label>
              <Input
                id="full_name"
                placeholder={t('profile.fullNamePlaceholder')}
                {...register('full_name')}
              />
              {errors.full_name?.message && (
                <p className="text-xs text-destructive">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">{t('profile.email')}</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                className="text-start"
                placeholder={t('profile.emailPlaceholder')}
                {...register('email')}
              />
              <p className="text-xs text-muted-foreground">{t('profile.emailNotice')}</p>
              {errors.email?.message && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Language Preference */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Globe className="size-4 text-muted-foreground" />
                  <span>{t('profile.language')}</span>
                </Label>
                <Select
                  value={selectedLanguage}
                  onValueChange={(val) => {
                    setValue('language', val as 'fa' | 'en');
                    setLanguage(val as 'fa' | 'en');
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fa">{t('common:language.fa')}</SelectItem>
                    <SelectItem value="en">{t('common:language.en')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Theme Preference */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <SunMoon className="size-4 text-muted-foreground" />
                  <span>{t('profile.theme')}</span>
                </Label>
                <Select
                  value={theme}
                  onValueChange={(val) => setTheme(val as 'light' | 'dark' | 'system')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="size-4" />
                        <span>{t('profile.themeLight')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="size-4" />
                        <span>{t('profile.themeDark')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <SunMoon className="size-4" />
                        <span>{t('profile.themeSystem')}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="me-1.5 size-4 animate-spin" />
                ) : (
                  <Save className="me-1.5 size-4" />
                )}
                {t('profile.saveChanges')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Logout Section ──────────────────────────────────────────── */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-destructive">
            {t('profile.logoutSection')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {t('profile.logoutDesc')}
          </p>
          <Button
            variant="destructive"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="shrink-0"
          >
            {loggingOut ? (
              <Loader2 className="me-1.5 size-4 animate-spin" />
            ) : (
              <LogOut className="me-1.5 size-4" />
            )}
            {t('profile.logoutBtn')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
