import { useState, useEffect } from 'react';

/**
 * SSR-safe media query hook
 * Returns false during SSR, then updates on client
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    // Set initial value
    setMatches(mediaQuery.matches);

    // Create listener
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener
    mediaQuery.addEventListener('change', handler);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

// Tailwind breakpoints
const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

/**
 * Returns true if viewport is below md breakpoint (< 768px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${parseInt(breakpoints.md) - 1}px)`);
}

/**
 * Returns true if viewport is between md and lg breakpoints (768px - 1023px)
 */
export function useIsTablet(): boolean {
  return useMediaQuery(
    `(min-width: ${breakpoints.md}) and (max-width: ${parseInt(breakpoints.lg) - 1}px)`
  );
}

/**
 * Returns true if viewport is lg or above (>= 1024px)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${breakpoints.lg})`);
}

/**
 * Returns true if device supports hover (not touch-only)
 */
export function useCanHover(): boolean {
  return useMediaQuery('(hover: hover)');
}
