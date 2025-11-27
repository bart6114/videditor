import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth, SignIn } from '@clerk/nextjs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Check, X, AlertCircle } from 'lucide-react';

interface InvitePreview {
  organizationName: string;
  organizationSlug: string;
  expiresAt: string;
  memberCount: number;
}

export default function InviteAcceptPage() {
  const router = useRouter();
  const { code } = router.query;
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!code || typeof code !== 'string') return;

    async function fetchInvite() {
      try {
        const response = await fetch(`/api/v1/invites/${code}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Invalid or expired invite');
        }
        const data = await response.json();
        setInvite(data.invite);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invite');
      } finally {
        setLoading(false);
      }
    }

    fetchInvite();
  }, [code]);

  async function handleAccept() {
    if (!code || typeof code !== 'string') return;
    setAccepting(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch(`/api/v1/invites/${code}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to accept invite');
      }

      setSuccess(true);
      // Redirect to projects page after a short delay
      setTimeout(() => {
        router.push('/projects');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  }

  // Show loading while checking auth status
  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show error state
  if (error && !invite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Invalid Invite</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push('/')} variant="outline">
            Go to Home
          </Button>
        </Card>
      </div>
    );
  }

  // Show sign-in form if not signed in
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">Join {invite?.organizationName}</h1>
            <p className="text-muted-foreground">
              Sign in or create an account to accept this invitation
            </p>
          </div>
          <SignIn
            routing="hash"
            afterSignInUrl={`/invite/${code}`}
            afterSignUpUrl={`/invite/${code}`}
          />
        </div>
      </div>
    );
  }

  // Show success state
  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Welcome!</h1>
          <p className="text-muted-foreground mb-4">
            You&apos;ve joined {invite?.organizationName}
          </p>
          <p className="text-sm text-muted-foreground">
            Redirecting to your projects...
          </p>
        </Card>
      </div>
    );
  }

  // Show invite acceptance form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Join {invite?.organizationName}
          </h1>
          <p className="text-muted-foreground">
            You&apos;ve been invited to join this organization
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current members</span>
            <span className="font-medium text-foreground">{invite?.memberCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">Invite expires</span>
            <span className="font-medium text-foreground">
              {invite?.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <Button onClick={handleAccept} disabled={accepting} className="w-full">
            {accepting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Accept Invite
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/projects')}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
