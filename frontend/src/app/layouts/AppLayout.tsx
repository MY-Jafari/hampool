import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PlusCircle,
  User,
  Users,
  X,
} from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { logout } from '@/features/auth/api';
import { useProfile } from '@/features/auth/useProfile';
import { useAuthStore } from '@/features/auth/store';
import { useNavStore } from '@/app/navStore';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { UserAvatar } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { LanguageSwitcher } from '@/shared/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/shared/components/ThemeSwitcher';
import { Logo } from '@/assets/Logo';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
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
  const { t, i18n } = useTranslation('common');
  const { user } = useAuthStore();
  const { collapsed, toggleCollapsed } = useNavStore();
  const isRtl = i18n.dir() === 'rtl';

  const navItems = [
    { to: '/dashboard', label: t('nav.dashboard', 'داشبورد'), icon: LayoutDashboard },
    { to: '/groups', label: t('nav.groups', 'گروه‌ها'), icon: Users },
    { to: '/profile', label: t('nav.profile', 'پروفایل'), icon: User },
  ];

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-border bg-card/70 backdrop-blur-md transition-all duration-300 ease-in-out lg:flex z-40',
        collapsed ? 'w-20 px-3 py-6' : 'w-64 px-4 py-6',
      )}
    >
      {/* Top Header: Logo & Single Dedicated Toggle Button */}
      {collapsed ? (
        <div className="flex flex-col items-center">
          <Link
            to="/dashboard"
            className="mb-4 flex items-center justify-center transition-transform hover:scale-105"
            title={t('brand.name', 'هم‌پول')}
          >
            <Logo variant="mark" size={40} />
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex size-9 items-center justify-center rounded-xl border border-border bg-background/90 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={t('nav.expand', 'باز کردن منو')}
              >
                {isRtl ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side={isRtl ? 'left' : 'right'}>
              {t('nav.expand', 'باز کردن منو')}
            </TooltipContent>
          </Tooltip>
          {/* Subtle separator below toggle in collapsed mode */}
          <div className="my-5 h-px w-8 bg-border/70" />
        </div>
      ) : (
        <div className="mb-6 flex items-center justify-between px-1">
          <Link
            to="/dashboard"
            className="flex items-center transition-opacity hover:opacity-85"
            title={t('brand.name', 'هم‌پول')}
          >
            <Logo variant="full" size={36} />
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex size-8 items-center justify-center rounded-lg border border-border bg-background/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={t('nav.collapse', 'بستن منو')}
              >
                <PanelLeftClose className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={isRtl ? 'left' : 'right'}>
              {t('nav.collapse', 'بستن منو')}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Navigation Items with Generous Spacing */}
      <nav
        className={cn(
          'flex flex-1 flex-col',
          collapsed ? 'gap-4 items-center' : 'gap-2',
        )}
      >
        {navItems.map(({ to, label, icon: Icon }) => {
          if (collapsed) {
            return (
              <Tooltip key={to}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      cn(
                        'flex size-12 items-center justify-center rounded-2xl transition-all',
                        isActive
                          ? 'bg-primary/15 text-primary font-bold shadow-sm ring-1 ring-primary/25'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )
                    }
                  >
                    <Icon className="size-[22px] shrink-0" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side={isRtl ? 'left' : 'right'} className="font-medium">
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary font-bold shadow-sm shadow-primary/5'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              <Icon className="size-5 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer User Info */}
      <div className="mt-auto border-t border-border/70 pt-4">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/profile"
                className="flex size-12 mx-auto items-center justify-center rounded-2xl hover:bg-accent transition-colors"
              >
                <UserAvatar
                  name={user?.full_name}
                  phone={user?.phone_number}
                  src={user?.avatar}
                  size="sm"
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent side={isRtl ? 'left' : 'right'}>
              <p className="font-semibold">{user?.full_name || user?.phone_number}</p>
              <p className="text-[10px] text-muted-foreground" dir="ltr">{user?.phone_number}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
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
        )}
      </div>
    </aside>
  );
}

/**
 * Slide-over Mobile Drawer for navigation (داشبورد ، گروه‌ها ، پروفایل)
 */
export function MobileDrawer() {
  const { t, i18n } = useTranslation('common');
  const { user } = useAuthStore();
  const { mobileOpen, setMobileOpen } = useNavStore();
  const isRtl = i18n.dir() === 'rtl';

  if (!mobileOpen) return null;

  const navItems = [
    { to: '/dashboard', label: t('nav.dashboard', 'داشبورد'), icon: LayoutDashboard },
    { to: '/groups', label: t('nav.groups', 'گروه‌ها'), icon: Users },
    { to: '/profile', label: t('nav.profile', 'پروفایل'), icon: User },
  ];

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={() => setMobileOpen(false)}
      />

      {/* Drawer Content */}
      <div
        className={cn(
          'relative z-50 flex w-72 max-w-[85vw] flex-col border-border bg-card p-5 shadow-2xl animate-in duration-300',
          isRtl
            ? 'slide-in-from-right border-s ms-auto'
            : 'slide-in-from-left border-e me-auto',
        )}
      >
        {/* Drawer Header */}
        <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <Link to="/dashboard" onClick={() => setMobileOpen(false)}>
            <Logo variant="full" size={32} />
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={t('common:actions.close', 'بستن')}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Drawer Links */}
        <nav className="flex flex-1 flex-col gap-2.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              <Icon className="size-5 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}

          <div className="my-2 border-t border-border pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              asChild
              onClick={() => setMobileOpen(false)}
            >
              <Link to="/groups?new=1">
                <PlusCircle className="size-4" />
                <span>{t('nav.newGroup', 'گروه جدید')}</span>
              </Link>
            </Button>
          </div>
        </nav>

        {/* Drawer Footer User */}
        <div className="border-t border-border pt-4">
          <Link
            to="/profile"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent transition-colors"
          >
            <UserAvatar
              name={user?.full_name}
              phone={user?.phone_number}
              src={user?.avatar}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {user?.full_name || user?.phone_number}
              </p>
              <p className="truncate text-xs text-muted-foreground font-mono" dir="ltr">
                {user?.phone_number}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function BottomNav() {
  const { t } = useTranslation('common');
  const { toggleMobile } = useNavStore();

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
      <button
        type="button"
        onClick={toggleMobile}
        className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t('nav.menu', 'منو')}
      >
        <Menu className="size-5 shrink-0" />
        <span>{t('nav.menu', 'منو')}</span>
      </button>
    </nav>
  );
}

export function Header() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { user, refresh, clear } = useAuthStore();
  const { toggleMobile } = useNavStore();

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
        {/* Mobile-only Menu Drawer Toggle Button (No duplicate on desktop!) */}
        <button
          type="button"
          onClick={toggleMobile}
          className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          aria-label={t('nav.menu', 'منو')}
        >
          <Menu className="size-5" />
        </button>

        <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
          <Logo variant="mark" size={32} />
        </Link>

        <h2 className="hidden text-sm font-medium text-muted-foreground lg:block">
          {t('brand.tagline', 'مدیریت و تسهیم آسان هزینه‌های مشترک')}
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
              aria-label={t('nav.profile', 'پروفایل')}
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
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-dvh bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
          <Header />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
        <BottomNav />
        <MobileDrawer />
      </div>
    </TooltipProvider>
  );
}
