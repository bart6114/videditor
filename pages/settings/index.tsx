import { useEffect, useState } from 'react';
import WorkspaceLayout from '@/components/layout/WorkspaceLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/api/client';
import { Loader2, Save, Check } from 'lucide-react';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@shared/index';

import { SiYoutube, SiInstagram, SiTiktok } from '@icons-pack/react-simple-icons';

// LinkedIn icon as inline SVG (not available in simple-icons)
const LinkedInIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const PLATFORM_ICONS: Record<SocialPlatform, React.ComponentType<{ size?: number }>> = {
  youtube: SiYoutube,
  instagram: SiInstagram,
  tiktok: SiTiktok,
  linkedin: LinkedInIcon,
};

interface UserSettings {
  defaultCustomPrompt: string | null;
  defaultSocialPlatforms: SocialPlatform[];
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
};

export default function Settings() {
  const { call } = useApi();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [defaultCustomPrompt, setDefaultCustomPrompt] = useState('');
  const [defaultSocialPlatforms, setDefaultSocialPlatforms] = useState<SocialPlatform[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await call<{ settings: UserSettings }>('/v1/user/settings');
        setDefaultCustomPrompt(data.settings.defaultCustomPrompt || '');
        setDefaultSocialPlatforms(data.settings.defaultSocialPlatforms || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [call]);

  function togglePlatform(platform: SocialPlatform) {
    setDefaultSocialPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      await call('/v1/user/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          defaultCustomPrompt: defaultCustomPrompt.trim() || null,
          defaultSocialPlatforms,
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

              <div>
                <label className="text-sm font-medium mb-2 block text-foreground">
                  Default Social Platforms
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  Choose platforms to generate titles and descriptions for by default
                </p>
                <div className="flex flex-wrap gap-2">
                  {SOCIAL_PLATFORMS.map((platform) => {
                    const isSelected = defaultSocialPlatforms.includes(platform)
                    const Icon = PLATFORM_ICONS[platform]
                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => togglePlatform(platform)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                        }`}
                        title={PLATFORM_LABELS[platform]}
                      >
                        <Icon size={18} />
                        <span className="text-sm font-medium">{PLATFORM_LABELS[platform]}</span>
                      </button>
                    )
                  })}
                </div>
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
