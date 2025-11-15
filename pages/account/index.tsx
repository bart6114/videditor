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
          <Loader2 className="w-8 h-8 animate-spin text-[#37b680]" />
        </div>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout title="Account">
      <div className="max-w-4xl">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-white mb-2">Account Information</h2>
          <p className="text-gray-400">Manage your account details and preferences</p>
        </div>

        <div className="space-y-6">
          {/* Profile Information */}
          <Card className="bg-[#0f1419] border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Profile</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={user?.emailAddresses[0]?.emailAddress || ''}
                  disabled
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Full Name
                </label>
                <Input
                  type="text"
                  value={user?.fullName || ''}
                  disabled
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
          </Card>

          {/* Plan Information */}
          <Card className="bg-[#0f1419] border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Plan</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Current Plan</p>
                  <p className="text-sm text-gray-400">Free Plan</p>
                </div>
                <Button className="bg-primary hover:bg-primary/90 text-white">
                  Upgrade
                </Button>
              </div>
            </div>
          </Card>

          {/* Danger Zone */}
          <Card className="bg-[#0f1419] border-red-900/20 p-6">
            <h3 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Delete Account</p>
                  <p className="text-sm text-gray-400">Permanently delete your account and all data</p>
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
