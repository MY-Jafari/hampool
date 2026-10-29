import React from 'react';

type IllustrationProps = React.SVGProps<SVGSVGElement> & { size?: number };

export function EmptyPoolIllustration({ size = 160, className = '', ...props }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`mx-auto ${className}`}
      {...props}
    >
      <circle cx="100" cy="100" r="80" className="fill-primary/5" />
      <ellipse cx="100" cy="140" rx="60" ry="16" className="fill-primary/10" />
      {/* Floating coin */}
      <circle cx="100" cy="85" r="30" className="fill-primary/20 stroke-primary" strokeWidth="2" strokeDasharray="4 4" />
      <circle cx="100" cy="85" r="22" className="fill-card stroke-primary/40" strokeWidth="1.5" />
      <path
        d="M93 85C93 81.134 96.134 78 100 78C103.866 78 107 81.134 107 85C107 88.866 103.866 92 100 92"
        className="stroke-primary"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="100" cy="85" r="2" className="fill-primary" />
      {/* Small floating sparkles */}
      <circle cx="65" cy="65" r="3" className="fill-emerald-400 opacity-60" />
      <circle cx="140" cy="75" r="4" className="fill-emerald-400 opacity-40" />
      <circle cx="130" cy="115" r="2.5" className="fill-teal-300 opacity-70" />
    </svg>
  );
}

export function ErrorIllustration({ size = 160, className = '', ...props }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`mx-auto ${className}`}
      {...props}
    >
      <circle cx="100" cy="100" r="80" className="fill-destructive/5" />
      <polygon
        points="100,45 160,150 40,150"
        className="fill-card stroke-destructive"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <line x1="100" y1="80" x2="100" y2="115" className="stroke-destructive" strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="132" r="2.5" className="fill-destructive" />
    </svg>
  );
}

export function OfflineIllustration({ size = 160, className = '', ...props }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`mx-auto ${className}`}
      {...props}
    >
      <circle cx="100" cy="100" r="80" className="fill-warning/5" />
      <path
        d="M60 125h75a25 25 0 0 0 5-49.5 35 35 0 0 0-68-10.5 25 25 0 0 0-12 60z"
        className="fill-card stroke-warning"
        strokeWidth="2.5"
      />
      <line x1="50" y1="50" x2="150" y2="150" className="stroke-destructive" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
