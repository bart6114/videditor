import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Loader2, Send, ArrowLeft, ShieldAlert, Megaphone, Info, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/api/client';
import type { InboxMessageType } from '@shared/index';

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { call } = useApi();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  // Form state
  const [messageType, setMessageType] = useState<InboxMessageType>('info');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [actionLabel, setActionLabel] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);

  // Replay scheduled post state
  const [replayPostId, setReplayPostId] = useState('');
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<{ success: boolean; platform?: string; jobId?: string; error?: string } | null>(null);

  // Check if user is admin on mount
  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      router.push('/sign-in');
      return;
    }

    checkAdminStatus();
  }, [isLoaded, user]);

  async function checkAdminStatus() {
    try {
      const result = await call<{ isAdmin: boolean }>('/v1/admin/check');
      setIsAdmin(result.isAdmin);
    } catch (error) {
      console.error('Failed to check admin status:', error);
      setIsAdmin(false);
    } finally {
      setIsCheckingAdmin(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const result = await call<{ messageCount: number }>('/v1/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          type: messageType,
          title: title.trim(),
          body: body.trim(),
          actionUrl: actionUrl.trim() || undefined,
          actionLabel: actionLabel.trim() || undefined,
        }),
      });

      setSubmitResult({ success: true, count: result.messageCount });

      // Clear form on success
      setTitle('');
      setBody('');
      setActionUrl('');
      setActionLabel('');
    } catch (error) {
      setSubmitResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to broadcast message',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReplay(e: React.FormEvent) {
    e.preventDefault();
    setIsReplaying(true);
    setReplayResult(null);

    try {
      const result = await call<{ platform: string; jobId: string }>('/v1/admin/replay-scheduled-post', {
        method: 'POST',
        body: JSON.stringify({ scheduledPostId: replayPostId.trim() }),
      });

      setReplayResult({ success: true, platform: result.platform, jobId: result.jobId });
      setReplayPostId('');
    } catch (error) {
      setReplayResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to replay scheduled post',
      });
    } finally {
      setIsReplaying(false);
    }
  }

  // Loading state
  if (!isLoaded || isCheckingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Access denied state
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don&apos;t have permission to access the admin panel.
          </p>
          <Link href="/projects">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Admin panel
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <Link href="/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
        </div>

        {/* Broadcast Form */}
        <div className="bg-card border border-border rounded-xl shadow-lg">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Broadcast Message
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Send a message to all users
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Message Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Message Type
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMessageType('info')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                    messageType === 'info'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background hover:bg-secondary/50 text-muted-foreground'
                  }`}
                >
                  <Info className="h-4 w-4" />
                  Info
                </button>
                <button
                  type="button"
                  onClick={() => setMessageType('announcement')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                    messageType === 'announcement'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background hover:bg-secondary/50 text-muted-foreground'
                  }`}
                >
                  <Megaphone className="h-4 w-4" />
                  Announcement
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">
                Title <span className="text-destructive">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter message title"
                maxLength={255}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>

            {/* Body */}
            <div>
              <label htmlFor="body" className="block text-sm font-medium text-foreground mb-2">
                Body <span className="text-destructive">*</span>
              </label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter message body"
                rows={4}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
              />
            </div>

            {/* Action URL */}
            <div>
              <label htmlFor="actionUrl" className="block text-sm font-medium text-foreground mb-2">
                Action URL <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="actionUrl"
                type="text"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="https://example.com or /projects"
                maxLength={2048}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>

            {/* Action Label - only show if URL is provided */}
            {actionUrl.trim() && (
              <div>
                <label htmlFor="actionLabel" className="block text-sm font-medium text-foreground mb-2">
                  Action Label <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  id="actionLabel"
                  type="text"
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  placeholder="e.g., Learn More, View Details"
                  maxLength={100}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
            )}

            {/* Submit Result */}
            {submitResult && (
              <div
                className={`p-4 rounded-lg ${
                  submitResult.success
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {submitResult.success ? (
                  <p>Message sent to {submitResult.count} user{submitResult.count !== 1 ? 's' : ''}!</p>
                ) : (
                  <p>Error: {submitResult.error}</p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isSubmitting || !title.trim() || !body.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send to All Users
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Replay Scheduled Post Form */}
        <div className="bg-card border border-border rounded-xl shadow-lg mt-6">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Replay Scheduled Post
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Re-publish a scheduled post by ID
            </p>
          </div>

          <form onSubmit={handleReplay} className="p-6 space-y-6">
            {/* Scheduled Post ID */}
            <div>
              <label htmlFor="replayPostId" className="block text-sm font-medium text-foreground mb-2">
                Scheduled Post ID <span className="text-destructive">*</span>
              </label>
              <input
                id="replayPostId"
                type="text"
                value={replayPostId}
                onChange={(e) => setReplayPostId(e.target.value)}
                placeholder="spost_..."
                required
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm"
              />
            </div>

            {/* Replay Result */}
            {replayResult && (
              <div
                className={`p-4 rounded-lg ${
                  replayResult.success
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {replayResult.success ? (
                  <p>Replay initiated for {replayResult.platform} (Job: {replayResult.jobId})</p>
                ) : (
                  <p>Error: {replayResult.error}</p>
                )}
              </div>
            )}

            {/* Replay Button */}
            <Button type="submit" className="w-full" disabled={isReplaying || !replayPostId.trim()}>
              {isReplaying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Replaying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Replay Post
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
