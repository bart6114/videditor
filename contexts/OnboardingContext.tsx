'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/router';
import { useApi } from '@/lib/api/client';
import { TOUR_IDS, TourId } from '@/components/onboarding/tour-ids';

interface OnboardingContextValue {
  completedTours: Record<string, boolean>;
  activeTourId: string | null;
  isLoading: boolean;
  isTourCompleted: (tourId: string) => boolean;
  shouldShowTour: (tourId: string) => boolean;
  startTour: (tourId: string) => void;
  completeTour: (tourId: string) => Promise<void>;
  skipTour: (tourId: string) => Promise<void>;
  resetTourForDev: (tourId: string) => void;
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

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { call } = useApi();
  const router = useRouter();

  const [completedTours, setCompletedTours] = useState<Record<string, boolean>>({});
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Dev override ref - using ref avoids causing re-renders and useEffect re-triggers
  const devOverrideRef = useRef<string | null>(null);

  // Handle dev override via query param or localStorage (dev mode only)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (!router.isReady) return;

    const tourParam = router.query.tour;
    if (tourParam === 'reset' || tourParam === 'start') {
      localStorage.setItem(DEV_TOUR_OVERRIDE_KEY, TOUR_IDS.PROJECTS_OVERVIEW);
      devOverrideRef.current = TOUR_IDS.PROJECTS_OVERVIEW;
    } else if (typeof tourParam === 'string' && Object.values(TOUR_IDS).includes(tourParam as TourId)) {
      localStorage.setItem(DEV_TOUR_OVERRIDE_KEY, tourParam);
      devOverrideRef.current = tourParam;
    } else {
      const stored = localStorage.getItem(DEV_TOUR_OVERRIDE_KEY);
      devOverrideRef.current = stored && Object.values(TOUR_IDS).includes(stored as TourId) ? stored : null;
    }
  }, [router.isReady, router.query.tour]);

  // Fetch completed tours from API
  const fetchCompletedTours = useCallback(async () => {
    try {
      const data = await call<{ completedTours: Record<string, boolean> }>('/v1/user/onboarding');
      return data.completedTours;
    } catch (err) {
      console.error('Error fetching completed tours:', err);
      return {}; // Default to empty on error
    }
  }, [call]);

  // Initialize - fetch completed tours
  useEffect(() => {
    // Don't do anything until Clerk is done loading
    if (!isLoaded) return;

    // If user is not signed in, we won't fetch tours - tours shouldn't show to signed-out users
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }

    const initialize = async () => {
      setIsLoading(true);
      const tours = await fetchCompletedTours();
      setCompletedTours(tours);
      setIsLoading(false);
    };

    initialize();
  }, [isLoaded, isSignedIn, fetchCompletedTours]);

  // Check if a tour is completed
  const isTourCompleted = useCallback(
    (tourId: string): boolean => {
      return !!completedTours[tourId];
    },
    [completedTours]
  );

  // Check if a tour should show (not completed and no active tour)
  const shouldShowTour = useCallback(
    (tourId: string): boolean => {
      if (isLoading) return false;
      if (activeTourId) return false; // Another tour is active

      // Check dev override (ref read doesn't cause re-renders)
      if (devOverrideRef.current === tourId) return true;

      return !completedTours[tourId];
    },
    [isLoading, activeTourId, completedTours]
  );

  // Start a tour
  const startTour = useCallback((tourId: string) => {
    setActiveTourId(tourId);
  }, []);

  // Complete a tour
  const completeTour = useCallback(
    async (tourId: string) => {
      try {
        await call('/v1/user/onboarding', {
          method: 'PATCH',
          body: JSON.stringify({ tourId, completed: true }),
        });
        setCompletedTours((prev) => ({ ...prev, [tourId]: true }));
        setActiveTourId(null);

        // Clear dev override
        if (process.env.NODE_ENV === 'development') {
          localStorage.removeItem(DEV_TOUR_OVERRIDE_KEY);
          devOverrideRef.current = null;
        }
      } catch (err) {
        console.error('Error completing tour:', err);
        // Still hide tour on error
        setActiveTourId(null);
      }
    },
    [call]
  );

  // Skip a tour (same as complete for tracking)
  const skipTour = useCallback(
    async (tourId: string) => {
      await completeTour(tourId);
    },
    [completeTour]
  );

  // Dev-only: Reset a tour
  const resetTourForDev = useCallback((tourId: string) => {
    if (process.env.NODE_ENV !== 'development') return;

    localStorage.setItem(DEV_TOUR_OVERRIDE_KEY, tourId);
    devOverrideRef.current = tourId;
    setCompletedTours((prev) => ({ ...prev, [tourId]: false }));
    setActiveTourId(tourId);
  }, []);

  const value: OnboardingContextValue = {
    completedTours,
    activeTourId,
    isLoading,
    isTourCompleted,
    shouldShowTour,
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
