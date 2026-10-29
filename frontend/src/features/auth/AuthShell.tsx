import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/assets/Logo';
import { LanguageSwitcher } from '@/shared/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/shared/components/ThemeSwitcher';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8 sm:px-6">
      {/* Top action controls: language and theme */}
      <div className="absolute top-4 end-4 flex items-center gap-2">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>

      <div className="mb-6 flex flex-col items-center text-center">
        <Link to="/login" className="inline-block transition-transform hover:scale-105 active:scale-95">
          <Logo variant="full" size={40} />
        </Link>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 p-6 sm:p-8 shadow-xl backdrop-blur-md animate-fade-in">
        <div className="mb-6 text-start">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        {children}
      </div>

      {footer && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}
