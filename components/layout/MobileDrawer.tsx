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
            'fixed inset-y-0 left-0 z-50 h-full w-[280px] bg-card border-r border-border shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
            'duration-300 ease-in-out'
          )}
        >
          {/* Header with close button */}
          <div className="flex h-14 items-center justify-between px-4 border-b border-border/50">
            <MonkeyLogo size="md" linkTo="/" showText={false} />
            <DialogPrimitive.Close className="rounded-md p-2 hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
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
                      'group flex items-center justify-between px-3 py-3 text-base font-medium rounded-lg',
                      'min-h-[44px] text-muted-foreground/50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center">
                      <Icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </div>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
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
                    'group flex items-center px-3 py-3 text-base font-medium rounded-lg transition-all duration-200',
                    'min-h-[44px]', // Touch-friendly height
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary active:scale-95'
                  )}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Organization Switcher & User Profile */}
          <div className="border-t border-border/50 p-4 space-y-3">
            {/* Organization Switcher */}
            {orgContext && orgContext.currentOrganization && (
              <div className="relative">
                <button
                  onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors min-h-[44px]"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground truncate">
                      {orgContext.currentOrganization.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
                    <div className="absolute left-0 right-0 bottom-full mb-1 z-20 bg-popover border border-border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                      {orgContext.organizations.map((org) => (
                        <button
                          key={org.id}
                          onClick={() => handleSwitchOrg(org.id)}
                          className="w-full flex items-center gap-3 px-3 py-3 hover:bg-secondary/50 transition-colors min-h-[44px]"
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium text-foreground truncate">
                              {org.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
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

            {/* User Profile */}
            {user && (
              <div className="px-2 py-2 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-3">
                  {user.imageUrl && (
                    <Image
                      src={user.imageUrl}
                      alt={user.fullName || user.emailAddresses[0]?.emailAddress || 'User'}
                      width={36}
                      height={36}
                      className="rounded-full ring-2 ring-primary/20"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user.fullName || user.firstName || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.emailAddresses[0]?.emailAddress}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="group flex w-full items-center px-3 py-3 text-base font-medium text-muted-foreground rounded-lg hover:text-foreground hover:bg-secondary transition-all duration-200 min-h-[44px] active:scale-95"
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
