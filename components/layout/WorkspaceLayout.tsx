import { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';
import MobileDrawer from './MobileDrawer';
import { InboxDropdown } from '@/components/inbox';

interface WorkspaceLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function WorkspaceLayout({ children, title }: WorkspaceLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen md:h-screen bg-background md:overflow-hidden">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      <MobileDrawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:overflow-hidden">
        {/* Mobile Header - visible only on mobile */}
        <MobileHeader title={title} onMenuClick={() => setMobileMenuOpen(true)} />

        {/* Desktop Top Bar - hidden on mobile */}
        <div className="hidden md:flex h-16 bg-card border-b border-border items-center justify-between px-8">
          <div>
            {title && <h1 className="text-xl font-semibold text-foreground">{title}</h1>}
          </div>
          <div className="flex items-center">
            <InboxDropdown />
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 md:overflow-y-auto">
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
