import Link from 'next/link';
import { cn } from '@/lib/utils';

interface MonkeyLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  linkTo?: string;
  showText?: boolean;
  vertical?: boolean;
}

const sizeClasses = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
  xl: 'text-6xl',
};

const textSizeClasses = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-4xl',
};

export function MonkeyLogo({
  size = 'md',
  className,
  linkTo,
  showText = true,
  vertical = false,
}: MonkeyLogoProps) {
  const logo = (
    <div className={cn(
      'flex',
      vertical ? 'flex-col items-center gap-1' : 'items-center gap-2',
      className
    )}>
      <span
        className={cn(
          'font-mono font-bold text-primary select-none',
          sizeClasses[size]
        )}
        aria-label="VidEditor.ai logo"
      >
        @(&apos;_&apos;)@
      </span>
      {showText && (
        <span
          className={cn(
            'font-semibold text-foreground',
            vertical ? 'text-xs' : textSizeClasses[size]
          )}
        >
          VidEditor.ai
        </span>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link href={linkTo} className="hover:opacity-80 transition-opacity">
        {logo}
      </Link>
    );
  }

  return logo;
}
