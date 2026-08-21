import { Link } from 'react-router-dom';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-xl font-black text-primary-foreground shadow-glow">
          هـ
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">هم‌پول</h1>
          <p className="text-xs text-muted-foreground">مدیریت هزینه‌های مشترک</p>
        </div>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      <Link to="/" className="sr-only">
        خانه
      </Link>
    </div>
  );
}
