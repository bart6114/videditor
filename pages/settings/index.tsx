import WorkspaceLayout from '@/components/layout/WorkspaceLayout';
import { Card } from '@/components/ui/card';

export default function Settings() {
  return (
    <WorkspaceLayout title="Settings">
      <div className="max-w-4xl">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-white mb-2">Application Settings</h2>
          <p className="text-gray-400">Manage your preferences and application settings</p>
        </div>

        <div className="space-y-6">
          {/* General Settings */}
          <Card className="bg-[#0f1419] border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">General</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Video Quality</p>
                  <p className="text-sm text-gray-400">Default quality for generated videos</p>
                </div>
                <select className="bg-gray-800 border-gray-700 text-white rounded-lg px-4 py-2">
                  <option>1080p</option>
                  <option>720p</option>
                  <option>480p</option>
                </select>
              </div>
            </div>
          </Card>

          {/* AI Settings */}
          <Card className="bg-[#0f1419] border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">AI Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Auto-generate Scenes</p>
                  <p className="text-sm text-gray-400">Automatically analyze and create scenes from videos</p>
                </div>
                <button className="bg-primary/10 text-primary px-4 py-2 rounded-lg hover:bg-primary/20 transition-colors">
                  Enabled
                </button>
              </div>
            </div>
          </Card>

          {/* Storage */}
          <Card className="bg-[#0f1419] border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Storage</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-medium">Storage Used</p>
                  <p className="text-gray-400">2.4 GB / 10 GB</p>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '24%' }}></div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
