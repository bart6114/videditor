import { useEffect, useState } from 'react';
import posthog from 'posthog-js';

interface FeatureFlagState {
  enabled: boolean;
  loading: boolean;
}

/**
 * Hook to check if a PostHog feature flag is enabled for the current user.
 * Returns loading state while flags are being fetched.
 */
export function useFeatureFlag(flagName: string): FeatureFlagState {
  const [state, setState] = useState<FeatureFlagState>({
    enabled: false,
    loading: true,
  });

  useEffect(() => {
    const checkFlag = () => {
      const value = posthog.isFeatureEnabled(flagName);
      setState({
        enabled: value === true,
        loading: false,
      });
    };

    // Check if PostHog has already loaded feature flags
    if (posthog.featureFlags && posthog.isFeatureEnabled !== undefined) {
      // Feature flags might already be loaded
      const featureFlagsLoaded = posthog.featureFlags.getFlags?.()?.length > 0;
      if (featureFlagsLoaded) {
        checkFlag();
      }
    }

    // Listen for feature flags to load/update
    posthog.onFeatureFlags(checkFlag);

    // Cleanup not needed as PostHog doesn't provide unsubscribe
  }, [flagName]);

  return state;
}

/**
 * YouTube scheduling is now enabled for everyone.
 * Previously gated by PostHog feature flag 'youtube-scheduling'.
 */
export function useYouTubeSchedulingEnabled(): FeatureFlagState {
  return { enabled: true, loading: false };
}

/**
 * Instagram scheduling is now enabled for everyone.
 * Previously gated by PostHog feature flag 'instagram-scheduling'.
 */
export function useInstagramSchedulingEnabled(): FeatureFlagState {
  return { enabled: true, loading: false };
}

/**
 * Hook that returns true if ANY scheduling platform is enabled.
 * Used for calendar access and navigation.
 */
export function useAnySchedulingEnabled(): FeatureFlagState {
  const youtube = useYouTubeSchedulingEnabled();
  const instagram = useInstagramSchedulingEnabled();
  return {
    enabled: youtube.enabled || instagram.enabled,
    loading: youtube.loading || instagram.loading,
  };
}
