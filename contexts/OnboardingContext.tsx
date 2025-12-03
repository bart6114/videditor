'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/router';
import { useApi } from '@/lib/api/client';

interface OnboardingContextValue {
  showTour: boolean;
  isLoading: boolean;
  tourCompleted: boolean;
  startTour: () => void;
  completeTour: () => Promise<void>;
  skipTour: () => Promise<void>;
  resetTourForDev: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

export function useOnboardingSafe() {
  return useContext(OnboardingContext);
}

interface OnboardingProviderProps {
  children: ReactNode;
}

const DEV_TOUR_OVERRIDE_KEY = 'videditor_dev_tour_override';
const DEV_TOUR_FORCE_SHOW = 'force_show';

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { call } = useApi();
  const router = useRouter();

  const [showTour, setShowTour] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tourCompleted, setTourCompleted] = useState(false);

  // Check for dev override via query param or localStorage
  const checkDevOverride = useCallback(() => {
    if (process.env.NODE_ENV !== 'development') return false;

    // Check query param: ?tour=reset or ?tour=start
    const tourParam = router.query.tour;
    if (tourParam === 'reset' || tourParam === 'start') {
      localStorage.setItem(DEV_TOUR_OVERRIDE_KEY, DEV_TOUR_FORCE_SHOW);
      return true;
    }

    // Check localStorage for persistent override
    return localStorage.getItem(DEV_TOUR_OVERRIDE_KEY) === DEV_TOUR_FORCE_SHOW;
  }, [router.query.tour]);

  // Fetch onboarding status from API
  const fetchOnboardingStatus = useCallback(async () => {
    try {
      const data = await call<{ onboardingCompleted: boolean }>('/v1/user/onboarding');
      return data.onboardingCompleted;
    } catch (err) {
      console.error('Error fetching onboarding status:', err);
      return true; // Default to completed on error to avoid blocking
    }
  }, [call]);

  // Initialize onboarding state
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setIsLoading(false);
      return;
    }

    // Only show tour on /projects page (dashboard)
    if (router.pathname !== '/projects') {
      setIsLoading(false);
      return;
    }

    const initialize = async () => {
      setIsLoading(true);

      // Check dev override first
      const devOverride = checkDevOverride();
      if (devOverride) {
        setShowTour(true);
        setTourCompleted(false);
        setIsLoading(false);
        return;
      }

      // Fetch actual status from DB
      const completed = await fetchOnboardingStatus();
      setTourCompleted(completed);
      setShowTour(!completed);
      setIsLoading(false);
    };

    initialize();
  }, [isLoaded, isSignedIn, router.pathname, fetchOnboardingStatus, checkDevOverride]);

  // Start tour manually
  const startTour = useCallback(() => {
    setShowTour(true);
  }, []);

  // Complete the tour
  const completeTour = useCallback(async () => {
    try {
      await call('/v1/user/onboarding', {
        method: 'PATCH',
        body: JSON.stringify({ completed: true }),
      });
      setTourCompleted(true);
      setShowTour(false);

      // Clear dev override
      if (process.env.NODE_ENV === 'development') {
        localStorage.removeItem(DEV_TOUR_OVERRIDE_KEY);
      }
    } catch (err) {
      console.error('Error completing onboarding:', err);
      // Still hide tour on error
      setShowTour(false);
    }
  }, [call]);

  // Skip the tour (same as complete for DB tracking)
  const skipTour = useCallback(async () => {
    await completeTour();
  }, [completeTour]);

  // Dev-only: Reset tour state
  const resetTourForDev = useCallback(() => {
    if (process.env.NODE_ENV !== 'development') return;

    localStorage.setItem(DEV_TOUR_OVERRIDE_KEY, DEV_TOUR_FORCE_SHOW);
    setShowTour(true);
    setTourCompleted(false);
  }, []);

  const value: OnboardingContextValue = {
    showTour,
    isLoading,
    tourCompleted,
    startTour,
    completeTour,
    skipTour,
    resetTourForDev,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
