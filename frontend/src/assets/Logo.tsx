import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  variant?: 'full' | 'mark' | 'wordmark';
  size?: number;
}

export function LogoMark({ size = 36, className = '', ...props }: Omit<LogoProps, 'variant'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      {...props}
    >
      <defs>
        {/* Emerald to Teal Gradient: Financial Growth & Trust */}
        <linearGradient id="hp-grad-emerald" x1="12" y1="8" x2="52" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>

        {/* Warm Golden Amber Gradient: Shared Coin Value */}
        <linearGradient id="hp-grad-amber" x1="48" y1="16" x2="16" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Electric Indigo to Violet: Modern Technology & Sync */}
        <linearGradient id="hp-grad-indigo" x1="20" y1="44" x2="44" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>

        {/* Center Coin Glow */}
        <linearGradient id="hp-grad-coin" x1="22" y1="20" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Outer Ring Ambient Shadow */}
        <filter id="hp-shadow" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0F172A" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Background Pill/Circle Accent */}
      <rect x="2" y="2" width="60" height="60" rx="18" className="fill-primary/10 stroke-primary/20" strokeWidth="1.5" />

      <g filter="url(#hp-shadow)">
        {/* Arc 1: Top-Right (Emerald Flow) */}
        <path
          d="M32 10C42.4934 10 51 18.5066 51 29C51 31.8687 50.3642 34.5888 49.2241 37.0308C47.8863 35.1585 45.4 33.6 42 33.6C36.6 33.6 33.6 37 32 41C32 29.5 39 21.5 39 21.5C37 19.5 34.6 18.2 32 18.2C27.5 18.2 23.5 20.6 21.2 24.2C22.6 16.2 26.6 10 32 10Z"
          fill="url(#hp-grad-emerald)"
        />

        {/* Arc 2: Bottom-Right to Left (Amber Flow) */}
        <path
          d="M51 29C51 39.4934 42.4934 48 32 48C28.2 48 24.8 46.8 22 44.8C24.4 43.2 25.8 40.5 25.8 37.5C25.8 32.5 21.5 28.5 16.5 28.5C18.2 25.2 21 22.5 24.5 20.8C20.2 22.8 16.8 26.5 15 31.2C13.7 34.2 13 37.5 13 41C13 43.6 13.6 46 14.8 48.2C9.5 44.4 6 38.2 6 31C6 19.8 15.2 10.8 26.4 10.1C21.8 13.5 18.8 19 18.8 25.2C18.8 26.4 19 27.5 19.2 28.6C21.5 24.5 26.4 21.8 31.8 21.8C35.5 21.8 39 23.2 41.6 25.6C44 28 45.6 31.2 46.2 34.8C49.2 33.2 51 31.2 51 29Z"
          fill="url(#hp-grad-amber)"
          opacity="0.95"
        />

        {/* Arc 3: Connecting Shared Pool Ring */}
        <path
          d="M32 14C41.9411 14 50 22.0589 50 32C50 41.9411 41.9411 50 32 50C22.0589 50 14 41.9411 14 32C14 26.5 16.5 21.5 20.4 18.2L24.8 22.6C22.4 24.8 21 28.2 21 32C21 38.0751 25.9249 43 32 43C38.0751 43 43 38.0751 43 32C43 25.9249 38.0751 21 32 21V14Z"
          fill="url(#hp-grad-indigo)"
          opacity="0.92"
        />

        {/* Center Coin: The Shared Pool */}
        <circle cx="32" cy="32" r="9" fill="url(#hp-grad-coin)" />
        <circle cx="32" cy="32" r="7.5" fill="none" stroke="#FEF08A" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.8" />

        {/* Central Embellishment: The "Ham" (together/wave) pool symbol */}
        <path
          d="M28 31.5C28 29.8 29.5 28.5 31.2 28.5C32.8 28.5 34 29.5 34.5 30.8C35 29.5 36.2 28.5 37.8 28.5C39.5 28.5 41 29.8 41 31.5C41 34 37.5 36.5 34.5 37.5C31.5 36.5 28 34 28 31.5Z"
          fill="#78350F"
          opacity="0.85"
        />
        <circle cx="28.5" cy="32" r="1.2" fill="#FEF08A" />
        <circle cx="35.5" cy="32" r="1.2" fill="#FEF08A" />
      </g>
    </svg>
  );
}

export function Logo({ variant = 'full', size = 36, className = '', ...props }: LogoProps) {
  if (variant === 'mark') {
    return <LogoMark size={size} className={className} {...props} />;
  }

  if (variant === 'wordmark') {
    return (
      <div className={`flex flex-col leading-tight select-none ${className}`}>
        <span className="text-xl font-black tracking-tight text-foreground font-vazirmatn">
          هم‌پول
        </span>
        <span className="text-[10px] font-bold tracking-widest text-primary uppercase font-mono">
          HAMPOOL
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <LogoMark size={size} {...props} />
      <div className="flex flex-col leading-tight">
        <span className="text-xl font-black tracking-tight text-foreground font-vazirmatn">
          هم‌پول
        </span>
        <span className="text-[10px] font-bold tracking-widest text-primary uppercase font-mono">
          HAMPOOL
        </span>
      </div>
    </div>
  );
}
