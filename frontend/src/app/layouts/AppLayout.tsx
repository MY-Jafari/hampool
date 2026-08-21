import { LayoutDashboard, LogOut, PlusCircle, User, Users } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { logout } from '@/features/auth/api';
import { useProfile } from '@/features/auth/useProfile';
import { useAuthStore } from '@/features/auth/store';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';

const navItems = [
  { to: '/', label: 'داشبورد', icon: LayoutDashboard, end: true },
  { to: '/groups', label: 'گروه‌ها', icon: Users },
  { to: '/profile', label: 'پروفایل', icon: User },
];

function Sidebar() {
  const { user } = useAuthStore();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-l border-border bg-card/50 px-4 py-6 lg:flex">
      <Link to="/" className="mb-8 flex items-center gap-2 px-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-lg font-black text-primary-foreground">
          هـ
        </span>
        <span className="text-lg font-extrabold tracking-tight">هم‌پول</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon className="size-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 px-2 pb-3">
          <Avatar className="size-8">
            <AvatarImage src={user?.avatar ?? undefined} />
            <AvatarFallback>{(user?.full_name || user?.phone_number || '؟').slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.full_name || user?.phone_number}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.phone_number}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-card/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )
          }
        >
          <Icon className="size-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function Header() {
  const navigate = useNavigate();
  const { user, refresh, clear } = useAuthStore();

  const handleLogout = async () => {
    try {
      if (refresh) await logout(refresh);
    } catch {
      // token may already be invalid — clear locally regardless
    }
    clear();
    toast.success('با موفقیت خارج شدید.');
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:px-8">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 lg:hidden">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-base font-black text-primary-foreground">
            هـ
          </span>
        </Link>
        <h2 className="hidden text-sm font-semibold text-muted-foreground lg:block">مدیریت هزینه‌های مشترک</h2>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
          <Link to="/groups?new=1">
            <PlusCircle className="size-4" />
            گروه جدید
          </Link>
        </Button>
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="منوی کاربر"
            >
              <Avatar className="size-8">
                <AvatarImage src={user?.avatar ?? undefined} />
                <AvatarFallback>{(user?.full_name || user?.phone_number || '؟').slice(0, 1)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <p className="truncate text-sm font-semibold">{user?.full_name || 'کاربر'}</p>
              <p className="truncate text-xs font-normal text-muted-foreground" dir="ltr">
                {user?.phone_number}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="size-4" />
              پروفایل
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut className="size-4" />
              خروج از حساب
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function AppLayout() {
  // Load the profile once, app-wide, so user data (phone, name, avatar) is
  // always available to every page and the header. No-op when not authed.
  useProfile();

  return (
    <div className="flex min-h-dvh bg-background">
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
