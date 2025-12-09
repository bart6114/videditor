import { Menu } from 'lucide-react';
import { MonkeyLogo } from '@/components/MonkeyLogo';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';

interface MobileHeaderProps {
  title?: string;
  onMenuClick: () => void;
}

export default function MobileHeader({ title, onMenuClick }: MobileHeaderProps) {
  const { user } = useUser();

  return (
    <header className="md:hidden sticky top-0 z-40 h-14 bg-card/95 backdrop-blur-sm border-b border-border flex items-center justify-between px-4">
      {/* Hamburger Menu Button */}
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Center - Title or Logo */}
      <div className="flex-1 flex justify-center">
        {title ? (
          <h1 className="text-base font-semibold text-foreground truncate max-w-[200px]">
            {title}
          </h1>
        ) : (
          <MonkeyLogo size="sm" linkTo="/" showText={false} />
        )}
      </div>

      {/* Right - User Avatar placeholder for symmetry */}
      <div className="min-h-[44px] min-w-[44px] flex items-center justify-center">
        {user?.imageUrl ? (
          <Image
            src={user.imageUrl}
            alt={user.fullName || 'User'}
            width={32}
            height={32}
            className="rounded-full ring-2 ring-primary/20"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-secondary" />
        )}
      </div>
    </header>
  );
}
