'use client';

import { useState, useEffect, useRef } from 'react';

interface AssetsCounterProps {
  className?: string;
}

function useCountUp(targetValue: number, duration: number = 2000): number {
  const [count, setCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (targetValue === 0) {
      setCount(0);
      return;
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      // Ease out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(easeOut * targetValue);

      setCount(currentValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setCount(targetValue);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [targetValue, duration]);

  return count;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

export function AssetsCounter({ className = '' }: AssetsCounterProps) {
  const [totalShorts, setTotalShorts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const animatedCount = useCountUp(totalShorts, 2000);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/v1/stats/public');
        if (response.ok) {
          const data = await response.json();
          setTotalShorts(data.totalShortsGenerated);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  // Don't render if still loading or no data
  if (isLoading || totalShorts === 0) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider cyber-clip-sm border-2 border-primary/30 bg-primary/10 text-primary ${className}`}
    >
      <span className="w-1.5 h-1.5 bg-primary animate-pulse" />
      {formatNumber(animatedCount)} shorts generated
    </span>
  );
}
