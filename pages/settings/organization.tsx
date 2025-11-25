import { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { useRouter } from 'next/router';

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

export default function OrganizationSettings() {
  const router = useRouter();
  const { call } = useApi();
  const { currentOrganization, refreshCurrentOrganization, isLoading: contextLoading } = useOrganization();
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

  useEffect(() => {
    // Set loading to false once context is loaded, regardless of whether org exists
    if (!contextLoading) {
      setLoading(false);
    }

    if (currentOrganization) {
      setOrgName(currentOrganization.name);
      loadMembers();
      if (isOwner) {
        loadInvites();
      }
    }
  }, [currentOrganization, contextLoading, loadMembers, loadInvites, isOwner]);

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
              You don't have an organization set up yet.
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
