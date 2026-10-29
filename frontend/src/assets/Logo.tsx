import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  variant?: 'full' | 'mark' | 'wordmark';
  size?: number;
}

export function Logo({ variant = 'full', size = 32, className = '', ...props }: LogoProps) {
  if (variant === 'mark') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
        {...props}
      >
        <circle cx="24" cy="24" r="22" className="fill-primary/10 stroke-primary/30" strokeWidth="2" />
        {/* Overlapping pool ripples */}
        <path
          d="M16 28C16 23.5817 19.5817 20 24 20C28.4183 20 32 23.5817 32 28C32 32.4183 28.4183 36 24 36C19.5817 36 16 32.4183 16 28Z"
          className="fill-primary"
        />
        <path
          d="M24 12C20.5 12 18 14.5 18 18C18 22 24 28 24 28C24 28 30 22 30 18C30 14.5 27.5 12 24 12Z"
          className="fill-emerald-400 dark:fill-emerald-300 opacity-90"
        />
        <circle cx="24" cy="28" r="3.5" className="fill-background" />
      </svg>
    );
  }

  if (variant === 'wordmark') {
    return (
      <div className={`flex flex-col leading-none ${className}`}>
        <span className="font-bold tracking-tight text-foreground text-lg">هم‌پول</span>
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">HamPool</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Logo variant="mark" size={size} />
      <div className="flex flex-col leading-none">
        <span className="font-extrabold tracking-tight text-foreground text-lg">هم‌پول</span>
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">HamPool</span>
      </div>
    </div>
  );
}
