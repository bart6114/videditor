import WorkspaceLayout from '@/components/layout/WorkspaceLayout';
import { Card } from '@/components/ui/card';

export default function Settings() {
  return (
    <WorkspaceLayout title="Settings">
      <div className="max-w-4xl">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-foreground mb-2">Application Settings</h2>
          <p className="text-muted-foreground">Manage your preferences and application settings</p>
        </div>

        <div className="space-y-6">
          {/* General Settings */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">General</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground font-medium">Video Quality</p>
                  <p className="text-sm text-muted-foreground">Default quality for generated videos</p>
                </div>
                <select className="bg-input border-border text-foreground rounded-lg px-4 py-2 transition-colors duration-200 hover:border-primary focus:border-primary outline-none">
                  <option>1080p</option>
                  <option>720p</option>
                  <option>480p</option>
                </select>
              </div>
            </div>
          </Card>

          {/* AI Settings */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">AI Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground font-medium">Auto-generate Scenes</p>
                  <p className="text-sm text-muted-foreground">Automatically analyze and create scenes from videos</p>
                </div>
                <button className="bg-primary/10 text-primary px-4 py-2 rounded-lg hover:bg-primary/20 transition-colors duration-200">
                  Enabled
                </button>
              </div>
            </div>
          </Card>

          {/* Storage */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Storage</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-foreground font-medium">Storage Used</p>
                  <p className="text-muted-foreground">2.4 GB / 10 GB</p>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: '24%' }}></div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
