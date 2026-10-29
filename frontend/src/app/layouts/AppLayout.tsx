import { LayoutDashboard, LogOut, PlusCircle, User, Users } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { logout } from '@/features/auth/api';
import { useProfile } from '@/features/auth/useProfile';
import { useAuthStore } from '@/features/auth/store';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { UserAvatar } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { LanguageSwitcher } from '@/shared/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/shared/components/ThemeSwitcher';
import { Logo } from '@/assets/Logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';

export function Sidebar() {
  const { t } = useTranslation('common');
  const { user } = useAuthStore();

  const navItems = [
    { to: '/dashboard', label: t('nav.dashboard', 'داشبورد'), icon: LayoutDashboard },
    { to: '/groups', label: t('nav.groups', 'گروه‌ها'), icon: Users },
    { to: '/profile', label: t('nav.profile', 'پروفایل'), icon: User },
  ];

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-border bg-card/60 backdrop-blur-md px-4 py-6 lg:flex">
      <Link to="/dashboard" className="mb-8 flex items-center px-2">
        <Logo variant="full" size={34} />
      </Link>
      <nav className="flex flex-1 flex-col gap-1.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon className="size-[18px] shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border pt-4">
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent transition-colors"
        >
          <UserAvatar
            name={user?.full_name}
            phone={user?.phone_number}
            src={user?.avatar}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {user?.full_name || user?.phone_number}
            </p>
            <p className="truncate text-xs text-muted-foreground font-mono" dir="ltr">
              {user?.phone_number}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const { t } = useTranslation('common');

  const navItems = [
    { to: '/dashboard', label: t('nav.dashboard', 'داشبورد'), icon: LayoutDashboard },
    { to: '/groups', label: t('nav.groups', 'گروه‌ها'), icon: Users },
    { to: '/profile', label: t('nav.profile', 'پروفایل'), icon: User },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-card/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden shadow-lg">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          <Icon className="size-5 shrink-0" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function Header() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { user, refresh, clear } = useAuthStore();

  const handleLogout = async () => {
    try {
      if (refresh) await logout(refresh);
    } catch {
      // token may already be invalid
    }
    clear();
    toast.success(t('auth.logoutSuccess', 'با موفقیت خارج شدید.'));
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md lg:px-8">
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
          <Logo variant="mark" size={32} />
        </Link>
        <h2 className="hidden text-sm font-medium text-muted-foreground lg:block">
          {t('brand.tagline', 'مدیریت و تسویه آسان هزینه‌های مشترک')}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex gap-1.5" asChild>
          <Link to="/groups?new=1">
            <PlusCircle className="size-4" />
            <span>{t('nav.newGroup', 'گروه جدید')}</span>
          </Link>
        </Button>
        <ThemeSwitcher />
        <LanguageSwitcher />
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="منوی کاربر / User menu"
            >
              <UserAvatar
                name={user?.full_name}
                phone={user?.phone_number}
                src={user?.avatar}
                size="sm"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="truncate text-sm font-semibold">{user?.full_name || 'کاربر'}</p>
              <p className="truncate text-xs font-normal text-muted-foreground font-mono" dir="ltr">
                {user?.phone_number}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="size-4" />
              <span>{t('nav.profile', 'پروفایل')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut className="size-4" />
              <span>{t('nav.logout', 'خروج از حساب')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function AppLayout() {
  useProfile();

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
        <Header />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
