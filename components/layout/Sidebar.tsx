import Link from 'next/link';
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
} from 'lucide-react';
import { useClerk, useUser } from '@clerk/nextjs';
import { MonkeyLogo } from '@/components/MonkeyLogo';
import { useOrganizationSafe } from '@/contexts/OrganizationContext';

const navigation = [
  { name: 'Projects', href: '/projects', icon: Video },
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
    <div className="flex h-full w-64 flex-col bg-card/50 backdrop-blur-sm border-r border-border">
      {/* Logo/Brand */}
      <div className="flex h-16 items-center justify-center border-b border-border/50">
        <MonkeyLogo size="lg" linkTo="/projects" showText={false} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 px-3 py-6">
        {navigation.map((item) => {
          const isActive = item.href === '/settings'
            ? router.pathname === '/settings'
            : router.pathname === item.href || router.pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                ${
                  isActive
                    ? 'bg-primary/15 text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
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
      <div className="border-t border-border/50 p-4 space-y-3">
        {/* Organization Switcher */}
        {orgContext && orgContext.currentOrganization && (
          <div className="relative">
            <button
              onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
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
                <div className="absolute left-0 right-0 bottom-full mb-1 z-20 bg-popover border border-border rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
                  {orgContext.organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => handleSwitchOrg(org.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-secondary/50 transition-colors"
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
                <img
                  src={user.imageUrl}
                  alt={user.fullName || user.emailAddresses[0]?.emailAddress || 'User'}
                  className="w-9 h-9 rounded-full ring-2 ring-primary/20"
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
        <button
          onClick={handleLogout}
          className="group flex w-full items-center px-3 py-2.5 text-sm font-medium text-muted-foreground rounded-lg hover:text-foreground hover:bg-secondary transition-all duration-200"
        >
          <LogOut className="mr-3 h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
          Logout
        </button>
      </div>
    </div>
  );
}
