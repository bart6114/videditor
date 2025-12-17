import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import WorkspaceLayout from '@/components/layout/WorkspaceLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/api/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  Loader2,
  Save,
  Check,
  Copy,
  Plus,
  Trash2,
  Crown,
  Users,
  Link as LinkIcon,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { SiYoutube, SiInstagram } from '@icons-pack/react-simple-icons';
import { useRouter } from 'next/router';
import { useYouTubeSchedulingEnabled, useInstagramSchedulingEnabled } from '@/hooks/useFeatureFlag';

interface Member {
  userId: string;
  email: string;
  name: string | null;
  role: 'owner' | 'member';
  joinedAt: string;
}

interface Invite {
  id: string;
  code: string;
  expiresAt: string;
  createdAt: string;
  usedAt: string | null;
  usedById: string | null;
}

interface SocialAccount {
  id: string;
  platform: 'youtube' | 'tiktok' | 'instagram';
  channelId: string | null;
  channelTitle: string | null;
  channelThumbnail: string | null;
  createdAt: string;
}

export default function OrganizationSettings() {
  const router = useRouter();
  const { call } = useApi();
  const { currentOrganization, refreshCurrentOrganization, isLoading: contextLoading } = useOrganization();
  const { enabled: youtubeSchedulingEnabled } = useYouTubeSchedulingEnabled();
  const { enabled: instagramSchedulingEnabled } = useInstagramSchedulingEnabled();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Organization details
  const [orgName, setOrgName] = useState('');

  // Members
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Invites
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);

  // Social Accounts
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [loadingSocialAccounts, setLoadingSocialAccounts] = useState(false);
  const [disconnectingYouTube, setDisconnectingYouTube] = useState(false);
  const [connectingInstagram, setConnectingInstagram] = useState(false);
  const [disconnectingInstagram, setDisconnectingInstagram] = useState(false);

  const isOwner = currentOrganization?.role === 'owner';

  const loadMembers = useCallback(async () => {
    if (!currentOrganization) return;
    setLoadingMembers(true);
    try {
      const data = await call<{ members: Member[] }>(
        `/v1/organizations/${currentOrganization.id}/members`
      );
      setMembers(data.members);
    } catch (err) {
      console.error('Error loading members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, [call, currentOrganization]);

  const loadInvites = useCallback(async () => {
    if (!currentOrganization || !isOwner) return;
    setLoadingInvites(true);
    try {
      const data = await call<{ invites: Invite[] }>(
        `/v1/organizations/${currentOrganization.id}/invites`
      );
      setInvites(data.invites);
    } catch (err) {
      console.error('Error loading invites:', err);
    } finally {
      setLoadingInvites(false);
    }
  }, [call, currentOrganization, isOwner]);

  const loadSocialAccounts = useCallback(async () => {
    if (!currentOrganization) return;
    setLoadingSocialAccounts(true);
    try {
      const data = await call<{ accounts: SocialAccount[] }>(
        `/v1/organizations/${currentOrganization.id}/social-accounts`
      );
      setSocialAccounts(data.accounts);
    } catch (err) {
      console.error('Error loading social accounts:', err);
    } finally {
      setLoadingSocialAccounts(false);
    }
  }, [call, currentOrganization]);

  useEffect(() => {
    // Set loading to false once context is loaded, regardless of whether org exists
    if (!contextLoading) {
      setLoading(false);
    }

    if (currentOrganization) {
      setOrgName(currentOrganization.name);
      loadMembers();
      loadSocialAccounts();
      if (isOwner) {
        loadInvites();
      }
    }
  }, [currentOrganization, contextLoading, loadMembers, loadInvites, loadSocialAccounts, isOwner]);

  // Handle OAuth callback messages
  useEffect(() => {
    const { youtube, instagram, message } = router.query;
    if (youtube === 'connected') {
      setSuccess('YouTube account connected successfully');
      loadSocialAccounts();
      // Clean up URL
      router.replace('/settings/organization', undefined, { shallow: true });
    } else if (instagram === 'connected') {
      setSuccess('Instagram account connected successfully');
      loadSocialAccounts();
      router.replace('/settings/organization', undefined, { shallow: true });
    } else if (instagram === 'error') {
      setError(typeof message === 'string' ? message : 'Failed to connect Instagram account');
      router.replace('/settings/organization', undefined, { shallow: true });
    } else if (youtube === 'error') {
      setError(typeof message === 'string' ? message : 'Failed to connect YouTube account');
      router.replace('/settings/organization', undefined, { shallow: true });
    }
  }, [router.query, router, loadSocialAccounts]);

  async function handleSave() {
    if (!currentOrganization || !isOwner) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      await call(`/v1/organizations/${currentOrganization.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: orgName.trim() }),
      });
      await refreshCurrentOrganization();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateInvite() {
    if (!currentOrganization) return;
    setCreatingInvite(true);
    setError(null);

    try {
      await call(`/v1/organizations/${currentOrganization.id}/invites`, {
        method: 'POST',
      });
      await loadInvites();
      setSuccess('Invite link created');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleDeleteInvite(inviteId: string) {
    if (!currentOrganization) return;
    try {
      await call(`/v1/organizations/${currentOrganization.id}/invites/${inviteId}`, {
        method: 'DELETE',
      });
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invite');
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!currentOrganization || !isOwner) return;
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      await call(`/v1/organizations/${currentOrganization.id}/members/${userId}`, {
        method: 'DELETE',
      });
      await loadMembers();
      await refreshCurrentOrganization();
      setSuccess('Member removed');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  }

  async function handleTransferOwnership(userId: string) {
    if (!currentOrganization || !isOwner) return;
    const member = members.find((m) => m.userId === userId);
    if (!confirm(`Transfer ownership to ${member?.name || member?.email}? You will become a regular member.`)) return;

    try {
      await call(`/v1/organizations/${currentOrganization.id}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: 'owner' }),
      });
      await loadMembers();
      await refreshCurrentOrganization();
      setSuccess('Ownership transferred');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer ownership');
    }
  }

  function copyInviteLink(code: string) {
    const link = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(link);
    setCopiedInvite(code);
    setTimeout(() => setCopiedInvite(null), 2000);
  }

  const [connectingYouTube, setConnectingYouTube] = useState(false);

  async function handleConnectYouTube() {
    setConnectingYouTube(true);
    setError(null);
    try {
      const response = await call<{ redirectUrl: string }>('/v1/social/youtube/connect');
      window.location.href = response.redirectUrl;
    } catch (err) {
      setConnectingYouTube(false);
      setError(err instanceof Error ? err.message : 'Failed to connect YouTube');
    }
  }

  async function handleDisconnectYouTube() {
    if (!confirm('Disconnect YouTube account? Scheduled posts will remain and automatically use a reconnected account.')) return;
    setDisconnectingYouTube(true);
    setError(null);

    try {
      await call('/v1/social/youtube/disconnect', {
        method: 'DELETE',
      });
      await loadSocialAccounts();
      setSuccess('YouTube account disconnected');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect YouTube');
    } finally {
      setDisconnectingYouTube(false);
    }
  }

  async function handleConnectInstagram() {
    setConnectingInstagram(true);
    setError(null);
    try {
      const response = await call<{ redirectUrl: string }>('/v1/social/instagram/connect');
      window.location.href = response.redirectUrl;
    } catch (err) {
      setConnectingInstagram(false);
      setError(err instanceof Error ? err.message : 'Failed to connect Instagram');
    }
  }

  async function handleDisconnectInstagram() {
    if (!confirm('Disconnect Instagram account? Scheduled posts will remain and automatically use a reconnected account.')) return;
    setDisconnectingInstagram(true);
    setError(null);

    try {
      await call('/v1/social/instagram/disconnect', {
        method: 'DELETE',
      });
      await loadSocialAccounts();
      setSuccess('Instagram account disconnected');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Instagram');
    } finally {
      setDisconnectingInstagram(false);
    }
  }

  const youtubeAccount = socialAccounts.find((a) => a.platform === 'youtube');
  const instagramAccount = socialAccounts.find((a) => a.platform === 'instagram');

  if (loading || contextLoading) {
    return (
      <WorkspaceLayout title="Organization Settings">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </WorkspaceLayout>
    );
  }

  if (!currentOrganization) {
    return (
      <WorkspaceLayout title="Organization Settings">
        <div className="max-w-4xl">
          <Card className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Organization Found</h2>
            <p className="text-muted-foreground mb-4">
              You don&apos;t have an organization set up yet.
            </p>
            <Button onClick={() => router.push('/projects')}>
              Go to Projects
            </Button>
          </Card>
        </div>
      </WorkspaceLayout>
    );
  }

  const activeInvites = invites.filter((inv) => !inv.usedAt && new Date(inv.expiresAt) > new Date());

  return (
    <WorkspaceLayout title="Organization Settings">
      <div className="max-w-4xl">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-foreground mb-2">Organization Settings</h2>
          <p className="text-muted-foreground">Manage your organization and team members</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600">
            {success}
          </div>
        )}

        <div className="space-y-6">
          {/* Organization Details */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">Organization Details</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Basic information about your organization
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-foreground">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={!isOwner}
                  className="w-full bg-input border border-border text-foreground rounded-lg px-4 py-3 transition-colors duration-200 hover:border-primary/50 focus:border-primary outline-none disabled:opacity-50"
                />
              </div>

              {isOwner && (
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
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Connected Accounts */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">Connected Accounts</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connect social media accounts to publish shorts directly
            </p>

            {loadingSocialAccounts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* YouTube Connection */}
                <div className="relative">
                  {!youtubeSchedulingEnabled && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] rounded-lg z-10 flex items-center justify-center">
                      <span className="px-3 py-1 bg-muted rounded-full text-sm font-medium text-muted-foreground">
                        Coming Soon
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      {youtubeAccount?.channelThumbnail ? (
                        <div className="relative">
                          <Image
                            src={youtubeAccount.channelThumbnail}
                            alt={youtubeAccount.channelTitle || 'YouTube Channel'}
                            width={40}
                            height={40}
                            className="rounded-full object-cover"
                          />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
                            <SiYoutube size={12} className="text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                          <SiYoutube className="w-6 h-6 text-red-500" />
                        </div>
                      )}
                      <div>
                        {youtubeAccount ? (
                          <>
                            <p className="font-medium text-foreground">{youtubeAccount.channelTitle}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              Connected
                              <Check className="w-3 h-3 text-green-500" />
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium text-foreground">YouTube</p>
                            <p className="text-sm text-muted-foreground">Not connected</p>
                          </>
                        )}
                      </div>
                    </div>
                    {isOwner && (
                      youtubeAccount ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDisconnectYouTube}
                          disabled={disconnectingYouTube}
                        >
                          {disconnectingYouTube ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Disconnect'
                          )}
                        </Button>
                      ) : (
                        <Button size="sm" onClick={handleConnectYouTube} disabled={connectingYouTube}>
                          {connectingYouTube ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Connect
                            </>
                          )}
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {/* Instagram Connection */}
                <div className="relative">
                  {!instagramSchedulingEnabled && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] rounded-lg z-10 flex items-center justify-center">
                      <span className="px-3 py-1 bg-muted rounded-full text-sm font-medium text-muted-foreground">
                        Coming Soon
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      {instagramAccount?.channelThumbnail ? (
                        <div className="relative">
                          <Image
                            src={instagramAccount.channelThumbnail}
                            alt={instagramAccount.channelTitle || 'Instagram Account'}
                            width={40}
                            height={40}
                            className="rounded-full object-cover"
                          />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-sm">
                            <SiInstagram size={12} className="text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                          <SiInstagram className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div>
                        {instagramAccount ? (
                          <>
                            <p className="font-medium text-foreground">@{instagramAccount.channelTitle}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              Connected
                              <Check className="w-3 h-3 text-green-500" />
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium text-foreground">Instagram</p>
                            <p className="text-sm text-muted-foreground">Not connected</p>
                          </>
                        )}
                      </div>
                    </div>
                    {isOwner && (
                      instagramAccount ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDisconnectInstagram}
                          disabled={disconnectingInstagram}
                        >
                          {disconnectingInstagram ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Disconnect'
                          )}
                        </Button>
                      ) : (
                        <Button size="sm" onClick={handleConnectInstagram} disabled={connectingInstagram}>
                          {connectingInstagram ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Connect
                            </>
                          )}
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {/* TikTok Connection */}
                <div className="relative">
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] rounded-lg z-10 flex items-center justify-center">
                    <span className="px-3 py-1 bg-muted rounded-full text-sm font-medium text-muted-foreground">
                      Coming Soon
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <span className="text-lg">🎵</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">TikTok</p>
                        <p className="text-sm text-muted-foreground">Not connected</p>
                      </div>
                    </div>
                    {isOwner && (
                      <Button size="sm" disabled>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Members */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Team Members</h3>
                <p className="text-sm text-muted-foreground">
                  {members.length} of 10 members
                </p>
              </div>
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>

            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {member.role === 'owner' ? (
                          <Crown className="w-5 h-5 text-amber-500" />
                        ) : (
                          <span className="text-sm font-medium text-primary">
                            {member.email[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {member.email}
                          {member.role === 'owner' && (
                            <span className="ml-2 text-xs text-amber-500 font-normal">Owner</span>
                          )}
                        </p>
                        {member.name && (
                          <p className="text-sm text-muted-foreground">{member.name}</p>
                        )}
                      </div>
                    </div>
                    {isOwner && member.role !== 'owner' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTransferOwnership(member.userId)}
                          title="Transfer ownership"
                        >
                          <Crown className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.userId)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Invites - Only visible to owner */}
          {isOwner && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Invite Links</h3>
                  <p className="text-sm text-muted-foreground">
                    Share these links to invite new members (expires in 7 days)
                  </p>
                </div>
                <Button
                  onClick={handleCreateInvite}
                  disabled={creatingInvite || members.length >= 10}
                  size="sm"
                >
                  {creatingInvite ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Create Invite
                </Button>
              </div>

              {loadingInvites ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeInvites.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <LinkIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No active invite links</p>
                  <p className="text-sm">Create an invite to add team members</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <LinkIcon className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-mono text-sm text-foreground">
                            {`${window.location.origin}/invite/${invite.code}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expires {new Date(invite.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInviteLink(invite.code)}
                        >
                          {copiedInvite === invite.code ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteInvite(invite.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
}
