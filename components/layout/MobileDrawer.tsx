import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useState } from 'react';
import {
  Video,
  User,
  LogOut,
  CreditCard,
  Building2,
  ChevronDown,
  Check,
  Users,
  Sliders,
  Calendar,
  X,
} from 'lucide-react';
import { useClerk, useUser } from '@clerk/nextjs';
import { MonkeyLogo } from '@/components/MonkeyLogo';
import { useOrganizationSafe } from '@/contexts/OrganizationContext';
import { cn } from '@/lib/utils';
import { useAnySchedulingEnabled } from '@/hooks/useFeatureFlag';

const navigation = [
  { name: 'Projects', href: '/projects', icon: Video },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Preferences', href: '/settings', icon: Sliders },
  { name: 'Billing', href: '/settings/billing', icon: CreditCard },
  { name: 'Organization', href: '/settings/organization', icon: Users },
  { name: 'Account', href: '/settings/account', icon: User },
];

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const orgContext = useOrganizationSafe();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const { enabled: schedulingEnabled } = useAnySchedulingEnabled();

  const handleLogout = async () => {
    await signOut();
    router.push('/sign-in');
  };

  const handleSwitchOrg = async (orgId: string) => {
    if (!orgContext) return;
    try {
      await orgContext.switchOrganization(orgId);
      setOrgDropdownOpen(false);
      onOpenChange(false);
      router.reload();
    } catch (err) {
      console.error('Failed to switch organization:', err);
    }
  };

  const handleNavClick = () => {
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />

        {/* Drawer Content */}
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 left-0 z-50 h-full w-[280px] bg-card border-r-2 border-border circuit-grid',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
            'duration-300 ease-in-out'
          )}
        >
          {/* Header with close button */}
          <div className="flex h-14 items-center justify-between px-4 border-b-2 border-border scanlines-subtle">
            <MonkeyLogo size="md" linkTo="/projects" showText={false} />
            <DialogPrimitive.Close className="cyber-clip-sm p-2 hover:bg-primary/5 hover:text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center border border-transparent hover:border-primary/30">
              <X className="h-5 w-5" />
              <span className="sr-only">Close menu</span>
            </DialogPrimitive.Close>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = item.href === '/settings'
                ? router.pathname === '/settings'
                : router.pathname === item.href || router.pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              const isCalendar = item.name === 'Calendar';
              const isDisabled = isCalendar && !schedulingEnabled;

              if (isDisabled) {
                return (
                  <div
                    key={item.name}
                    className={cn(
                      'group flex items-center justify-between px-3 py-3 text-base font-mono uppercase tracking-wider cyber-clip-sm',
                      'min-h-[44px] text-muted-foreground/50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center">
                      <Icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </div>
                    <span className="text-xs bg-muted px-1.5 py-0.5 cyber-clip-sm text-muted-foreground border border-border">
                      Soon
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    'group flex items-center px-3 py-3 text-base font-mono uppercase tracking-wider cyber-clip-sm transition-all duration-200',
                    'min-h-[44px]',
                    isActive
                      ? 'bg-primary/10 text-primary border-l-2 border-primary shadow-neon-subtle'
                      : 'text-muted-foreground hover:text-primary hover:bg-primary/5 active:scale-95'
                  )}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Organization Switcher & User Profile */}
          <div className="border-t-2 border-border p-4 space-y-3">
            {/* Organization Switcher */}
            {orgContext && orgContext.currentOrganization && (
              <div className="relative">
                <button
                  onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                  className="w-full flex items-center gap-3 px-3 py-3 cyber-clip-sm bg-muted hover:bg-primary/5 border border-border hover:border-primary/50 transition-colors min-h-[44px]"
                >
                  <div className="w-8 h-8 cyber-clip-sm bg-primary/10 flex items-center justify-center border border-primary/30">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-mono text-foreground truncate">
                      {orgContext.currentOrganization.name}
                    </p>
                    <p className="text-xs text-primary font-mono">
                      {orgContext.currentOrganization.credits} credits
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform',
                      orgDropdownOpen && 'rotate-180'
                    )}
                  />
                </button>

                {/* Dropdown - opens upward */}
                {orgDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setOrgDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 bottom-full mb-1 z-20 bg-card border-2 border-border cyber-clip py-1 max-h-48 overflow-y-auto">
                      {orgContext.organizations.map((org) => (
                        <button
                          key={org.id}
                          onClick={() => handleSwitchOrg(org.id)}
                          className="w-full flex items-center gap-3 px-3 py-3 hover:bg-primary/5 transition-colors min-h-[44px]"
                        >
                          <div className="w-8 h-8 cyber-clip-sm bg-primary/10 flex items-center justify-center border border-primary/30">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-mono text-foreground truncate">
                              {org.name}
                            </p>
                            <p className="text-xs text-primary font-mono">
                              {org.credits} credits
                            </p>
                          </div>
                          {org.id === orgContext.currentOrganization?.id && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="group flex w-full items-center px-3 py-3 text-base font-mono uppercase tracking-wider text-muted-foreground cyber-clip-sm hover:text-destructive hover:bg-destructive/5 transition-all duration-200 min-h-[44px] active:scale-95"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Logout
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
