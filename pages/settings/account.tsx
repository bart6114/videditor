import { useUser } from '@clerk/nextjs';
import WorkspaceLayout from '@/components/layout/WorkspaceLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export default function Account() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <WorkspaceLayout title="Account">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout title="Account">
      <div className="max-w-4xl">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-foreground mb-2">Account Information</h2>
          <p className="text-muted-foreground">Manage your account details and preferences</p>
        </div>

        <div className="space-y-6">
          {/* Profile Information */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Profile</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={user?.emailAddresses[0]?.emailAddress || ''}
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Full Name
                </label>
                <Input
                  type="text"
                  value={user?.fullName || ''}
                  disabled
                />
              </div>
            </div>
          </Card>

          {/* Plan Information */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Plan</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground font-medium">Current Plan</p>
                  <p className="text-sm text-muted-foreground">Free Plan</p>
                </div>
                <Button className="bg-primary hover:bg-primary/80 text-primary-foreground transition-colors duration-200">
                  Upgrade
                </Button>
              </div>
            </div>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/30 p-6">
            <h3 className="text-lg font-semibold text-destructive mb-4">Danger Zone</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground font-medium">Delete Account</p>
                  <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
                </div>
                <Button variant="destructive">
                  Delete Account
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
