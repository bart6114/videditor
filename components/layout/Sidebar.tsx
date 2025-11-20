import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home, Settings, User } from 'lucide-react';
import { useClerk, useUser } from '@clerk/nextjs';
import { MonkeyLogo } from '@/components/MonkeyLogo';

const navigation = [
  { name: 'Projects', href: '/projects', icon: Home },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Account', href: '/account', icon: User },
];

export default function Sidebar() {
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();

  const handleLogout = async () => {
    await signOut();
    router.push('/sign-in');
  };

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r border-border">
      {/* Logo/Brand */}
      <div className="flex h-16 items-center justify-center border-b border-border">
        <MonkeyLogo size="lg" linkTo="/projects" showText={false} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = router.pathname === item.href || router.pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
            >
              <Icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Logout */}
      <div className="border-t border-border p-4 space-y-3">
        {user && (
          <div className="px-3 py-2">
            <div className="flex items-center gap-3">
              {user.imageUrl && (
                <img
                  src={user.imageUrl}
                  alt={user.fullName || user.emailAddresses[0]?.emailAddress || 'User'}
                  className="w-8 h-8 rounded-full"
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
          className="flex w-full items-center px-3 py-2.5 text-sm font-medium text-muted-foreground rounded-lg hover:text-foreground hover:bg-muted/50 transition-all duration-200"
        >
          <User className="mr-3 h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
