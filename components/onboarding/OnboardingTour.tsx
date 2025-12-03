'use client';

import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useOnboardingSafe } from '@/contexts/OnboardingContext';
import { TOUR_STEPS } from './tour-steps';

export function OnboardingTour() {
  const onboarding = useOnboardingSafe();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!onboarding?.showTour || hasStartedRef.current) return;

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      hasStartedRef.current = true;

      const driverInstance = driver({
        showProgress: true,
        steps: TOUR_STEPS,
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Get Started',
        popoverClass: 'videditor-tour-popover',
        overlayColor: 'transparent',
        onDestroyStarted: () => {
          // User closed/skipped the tour
          onboarding.skipTour();
          driverInstance.destroy();
        },
        onDestroyed: () => {
          hasStartedRef.current = false;
        },
        onNextClick: () => {
          const currentIndex = driverInstance.getActiveIndex();
          if (currentIndex !== undefined && currentIndex === TOUR_STEPS.length - 1) {
            // Last step - complete the tour
            onboarding.completeTour();
            driverInstance.destroy();
          } else {
            driverInstance.moveNext();
          }
        },
      });

      driverRef.current = driverInstance;
      driverInstance.drive();
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
      hasStartedRef.current = false;
    };
  }, [onboarding?.showTour, onboarding]);

  // Inject custom styles for dark mode
  useEffect(() => {
    const styleId = 'videditor-tour-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .driver-popover.videditor-tour-popover {
        background-color: hsl(var(--card));
        color: hsl(var(--foreground));
        border: 1px solid hsl(var(--border));
        border-radius: 0.75rem;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      }

      .driver-popover.videditor-tour-popover .driver-popover-title {
        color: hsl(var(--foreground));
        font-size: 1.125rem;
        font-weight: 600;
      }

      .driver-popover.videditor-tour-popover .driver-popover-description {
        color: hsl(var(--muted-foreground));
        font-size: 0.875rem;
        line-height: 1.5;
      }

      .driver-popover.videditor-tour-popover .driver-popover-progress-text {
        color: hsl(var(--muted-foreground));
        font-size: 0.75rem;
      }

      .driver-popover.videditor-tour-popover .driver-popover-navigation-btns button {
        background-color: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        border: none;
        border-radius: 0.375rem;
        padding: 0.5rem 1rem;
        font-family: inherit;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
        box-shadow: none;
        text-shadow: none;
      }

      .driver-popover.videditor-tour-popover .driver-popover-navigation-btns button:hover {
        background-color: hsl(var(--primary) / 0.9);
      }

      .driver-popover.videditor-tour-popover .driver-popover-prev-btn {
        background-color: transparent !important;
        color: hsl(var(--muted-foreground)) !important;
        border: 1px solid hsl(var(--border)) !important;
      }

      .driver-popover.videditor-tour-popover .driver-popover-prev-btn:hover {
        background-color: hsl(var(--secondary)) !important;
        color: hsl(var(--foreground)) !important;
      }

      .driver-popover.videditor-tour-popover .driver-popover-close-btn {
        color: hsl(var(--muted-foreground));
      }

      .driver-popover.videditor-tour-popover .driver-popover-close-btn:hover {
        color: hsl(var(--foreground));
      }

      .driver-popover.videditor-tour-popover .driver-popover-arrow-side-left,
      .driver-popover.videditor-tour-popover .driver-popover-arrow-side-right,
      .driver-popover.videditor-tour-popover .driver-popover-arrow-side-top,
      .driver-popover.videditor-tour-popover .driver-popover-arrow-side-bottom {
        border-color: hsl(var(--card));
      }

      .driver-active-element {
        outline: 3px solid hsl(var(--primary)) !important;
        outline-offset: -3px;
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  return null;
}
