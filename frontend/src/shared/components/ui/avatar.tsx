import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/shared/lib/utils';

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full object-cover', className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-secondary text-sm font-semibold select-none',
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

// Deterministic pastel color palette for initials avatar
const AVATAR_PALETTE = [
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30',
  'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30',
  'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30',
  'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30',
  'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30',
] as const;

export function getInitials(name?: string | null): string {
  if (!name) return '؟';
  const clean = name.trim();
  if (!clean) return '؟';
  const words = clean.split(/\s+/);
  if (words.length >= 2 && words[0] && words[1]) {
    return `${words[0].charAt(0)}${words[1].charAt(0)}`;
  }
  return clean.slice(0, 2);
}

export function getDeterministicColor(seed?: string | null): string {
  const defaultColor = AVATAR_PALETTE[0];
  if (!seed) return defaultColor;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index] ?? defaultColor;
}

export interface UserAvatarProps {
  name?: string | null;
  phone?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  phone,
  src,
  size = 'md',
  className,
}) => {
  const seed = name || phone || 'User';
  const initials = getInitials(name || phone);
  const colorClass = getDeterministicColor(seed);

  const sizeClasses = {
    sm: 'size-7 text-xs',
    md: 'size-9 text-sm',
    lg: 'size-11 text-base',
    xl: 'size-14 text-lg',
  };

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {src && <AvatarImage src={src} alt={name || phone || 'Avatar'} />}
      <AvatarFallback className={cn(colorClass, 'font-bold uppercase')}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};

export { Avatar, AvatarImage, AvatarFallback };
