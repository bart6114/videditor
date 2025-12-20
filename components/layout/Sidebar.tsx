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
} from 'lucide-react';
import { useClerk, useUser } from '@clerk/nextjs';
import { MonkeyLogo } from '@/components/MonkeyLogo';
import { useOrganizationSafe } from '@/contexts/OrganizationContext';
import { useAnySchedulingEnabled } from '@/hooks/useFeatureFlag';

const navigation = [
  { name: 'Projects', href: '/projects', icon: Video },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Preferences', href: '/settings', icon: Sliders },
  { name: 'Billing', href: '/settings/billing', icon: CreditCard },
  { name: 'Organization', href: '/settings/organization', icon: Users },
  { name: 'Account', href: '/settings/account', icon: User },
];

export default function Sidebar() {
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
      // Refresh the page to load new org's data
      router.reload();
    } catch (err) {
      console.error('Failed to switch organization:', err);
    }
  };

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r-2 border-border circuit-grid" data-tour="sidebar">
      {/* Logo/Brand */}
      <div className="flex h-16 items-center justify-center border-b-2 border-border scanlines-subtle">
        <MonkeyLogo size="lg" linkTo="/projects" showText={false} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 px-3 py-6">
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
                className="group flex items-center justify-between px-3 py-2.5 text-sm font-mono uppercase tracking-wider cyber-clip-sm text-muted-foreground/50 cursor-not-allowed"
                title="Coming Soon"
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
              className={`
                group flex items-center px-3 py-2.5 text-sm font-mono uppercase tracking-wider cyber-clip-sm transition-all duration-200
                ${
                  isActive
                    ? 'bg-primary/10 text-primary border-l-2 border-primary shadow-neon-subtle'
                    : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
                }
              `}
            >
              <Icon className={`mr-3 h-5 w-5 transition-transform duration-200 ${!isActive && 'group-hover:scale-110'}`} />
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
              className="w-full flex items-center gap-3 px-3 py-2.5 cyber-clip-sm bg-muted hover:bg-primary/5 hover:border-primary/50 border border-border transition-all duration-200"
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
                className={`w-4 h-4 text-muted-foreground transition-transform ${
                  orgDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown - opens upward */}
            {orgDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setOrgDropdownOpen(false)}
                />
                <div className="absolute left-0 right-0 bottom-full mb-1 z-20 bg-card border-2 border-border cyber-clip py-1 max-h-64 overflow-y-auto">
                  {orgContext.organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => handleSwitchOrg(org.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-primary/5 transition-colors"
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

        <button
          onClick={handleLogout}
          className="group flex w-full items-center px-3 py-2.5 text-sm font-mono uppercase tracking-wider text-muted-foreground cyber-clip-sm hover:text-destructive hover:bg-destructive/5 transition-all duration-200"
        >
          <LogOut className="mr-3 h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
          Logout
        </button>
      </div>
    </div>
  );
}
