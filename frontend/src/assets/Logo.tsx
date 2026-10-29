import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  variant?: 'full' | 'mark' | 'wordmark';
  size?: number;
}

/**
 * Official HamPool Brand Logo
 * 4 connected nodes (white ring + vibrant emerald fill) linked in a diamond network
 * on a deep navy background (#0D2241).
 */
export function LogoMark({ size = 36, className = '', ...props }: Omit<LogoProps, 'variant'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      {...props}
    >
      {/* Deep Navy Squircle Background */}
      <rect width="400" height="400" rx="96" fill="#0D2241" />

      {/* Connecting White Diamond Track */}
      <polygon
        points="200,106 294,200 200,294 106,200"
        stroke="#FFFFFF"
        strokeWidth="15"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Top Node */}
      <circle cx="200" cy="106" r="56" fill="#FFFFFF" />
      <circle cx="200" cy="106" r="42" fill="#25CE7B" />

      {/* Right Node */}
      <circle cx="294" cy="200" r="56" fill="#FFFFFF" />
      <circle cx="294" cy="200" r="42" fill="#25CE7B" />

      {/* Bottom Node */}
      <circle cx="200" cy="294" r="56" fill="#FFFFFF" />
      <circle cx="200" cy="294" r="42" fill="#25CE7B" />

      {/* Left Node */}
      <circle cx="106" cy="200" r="56" fill="#FFFFFF" />
      <circle cx="106" cy="200" r="42" fill="#25CE7B" />
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
    <div className={`flex items-center gap-3 select-none ${className}`}>
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
