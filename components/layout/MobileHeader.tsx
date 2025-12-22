import { Menu } from 'lucide-react';
import { MonkeyLogo } from '@/components/MonkeyLogo';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { InboxDropdown } from '@/components/inbox';

interface MobileHeaderProps {
  title?: string;
  isEntityTitle?: boolean;
  onMenuClick: () => void;
}

export default function MobileHeader({ title, isEntityTitle, onMenuClick }: MobileHeaderProps) {
  const { user } = useUser();

  return (
    <header className="md:hidden sticky top-0 z-40 h-14 bg-card border-b-2 border-border flex items-center justify-between px-4 scanlines-subtle safe-area-top">
      {/* Hamburger Menu Button */}
      <button
        onClick={onMenuClick}
        className="cyber-clip-sm p-2 hover:bg-primary/5 hover:text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 border border-transparent hover:border-primary/30"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Center - Title or Logo */}
      <div className="flex-1 flex justify-center">
        {title ? (
          <h1 className={`text-base font-display tracking-widest text-primary truncate max-w-[45vw] ${isEntityTitle ? 'normal-case' : 'uppercase'}`}>
            {title}
          </h1>
        ) : (
          <MonkeyLogo size="sm" linkTo="/projects" showText={false} />
        )}
      </div>

      {/* Right - Inbox & User Avatar */}
      <div className="flex items-center gap-2">
        <InboxDropdown />
        {user?.imageUrl ? (
          <Image
            src={user.imageUrl}
            alt={user.fullName || 'User'}
            width={32}
            height={32}
            className="rounded-full ring-2 ring-primary/50"
          />
        ) : (
          <div className="w-8 h-8 cyber-clip-sm bg-muted border border-border" />
        )}
      </div>
    </header>
  );
}
