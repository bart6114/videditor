import { useEffect, useState } from 'react';
import WorkspaceLayout from '@/components/layout/WorkspaceLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/api/client';
import { Loader2, Save, Check } from 'lucide-react';

interface UserSettings {
  defaultCustomPrompt: string | null;
}

export default function Settings() {
  const { call } = useApi();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [defaultCustomPrompt, setDefaultCustomPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await call<{ settings: UserSettings }>('/v1/user/settings');
        setDefaultCustomPrompt(data.settings.defaultCustomPrompt || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [call]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      await call('/v1/user/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          defaultCustomPrompt: defaultCustomPrompt.trim() || null,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <WorkspaceLayout title="Settings">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout title="Settings">
      <div className="max-w-4xl">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-foreground mb-2">Settings</h2>
          <p className="text-muted-foreground">Manage your preferences</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">AI Settings</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure how the AI generates shorts from your videos
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-foreground">
                  Default Custom Instruction
                </label>
                <textarea
                  placeholder="e.g., Focus on educational content, prefer clips with strong hooks, avoid sections with background music..."
                  value={defaultCustomPrompt}
                  onChange={(e) => setDefaultCustomPrompt(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="w-full bg-input border border-border text-foreground rounded-lg px-4 py-3 transition-colors duration-200 hover:border-primary/50 focus:border-primary outline-none resize-none"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  This instruction is automatically applied when generating shorts. You can override it on a per-project basis.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : saved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
