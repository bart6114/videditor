'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Sparkles } from 'lucide-react';
import { SiYoutube, SiInstagram } from '@icons-pack/react-simple-icons';

const EXAMPLE_PROMPT = 'Schedule these 5 shorts over the next week, mornings between 8-10am';

const SCHEDULED_ITEMS = [
  { day: 'Mon', time: '8:30 AM', platform: 'youtube' },
  { day: 'Tue', time: '9:15 AM', platform: 'instagram' },
  { day: 'Wed', time: '8:45 AM', platform: 'youtube' },
  { day: 'Thu', time: '9:00 AM', platform: 'instagram' },
  { day: 'Fri', time: '8:15 AM', platform: 'youtube' },
];

export function AISchedulingDemo() {
  const [typedText, setTypedText] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [visibleItems, setVisibleItems] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  const typeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const itemsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearAllTimers = useCallback(() => {
    if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
    if (itemsIntervalRef.current) clearInterval(itemsIntervalRef.current);
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
  }, []);

  useEffect(() => {
    let charIndex = 0;
    let itemIndex = 0;

    // Reset state
    setTypedText('');
    setShowSchedule(false);
    setVisibleItems(0);

    // Type the prompt
    typeIntervalRef.current = setInterval(() => {
      if (charIndex <= EXAMPLE_PROMPT.length) {
        setTypedText(EXAMPLE_PROMPT.slice(0, charIndex));
        charIndex++;
      } else {
        if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);

        // After typing, show schedule with stagger
        setTimeout(() => {
          setShowSchedule(true);

          itemsIntervalRef.current = setInterval(() => {
            if (itemIndex < SCHEDULED_ITEMS.length) {
              setVisibleItems(itemIndex + 1);
              itemIndex++;
            } else {
              if (itemsIntervalRef.current) clearInterval(itemsIntervalRef.current);

              // Reset after a pause
              resetTimeoutRef.current = setTimeout(() => {
                setAnimationKey((k) => k + 1);
              }, 4000);
            }
          }, 200);
        }, 500);
      }
    }, 40);

    return clearAllTimers;
  }, [animationKey, clearAllTimers]);

  return (
    <div className="relative container mx-auto px-4 py-32">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-display uppercase tracking-widest mb-4 text-primary">
          AI-Powered Scheduling
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Describe your schedule in plain English. AI handles the rest.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Input side */}
          <div className="cyber-clip border-2 border-border bg-card p-6 md:p-8">
            <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground uppercase tracking-wider mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              Your Prompt
            </div>

            <div className="min-h-[100px] p-4 bg-background/50 border border-border/50 rounded font-mono text-lg">
              <span className="text-foreground">{typedText}</span>
              <span className="inline-block w-0.5 h-5 bg-primary animate-pulse ml-0.5" />
            </div>

            <div className="mt-4 text-sm text-muted-foreground/60 font-mono">
              {'>'} No spreadsheets. No manual time picking.
            </div>
          </div>

          {/* Output side - Calendar */}
          <div className="cyber-clip border-2 border-border bg-card p-6 md:p-8">
            <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground uppercase tracking-wider mb-4">
              <Calendar className="w-4 h-4 text-secondary" />
              Generated Schedule
            </div>

            <div
              className={`space-y-2 transition-all duration-500 ${
                showSchedule ? 'opacity-100' : 'opacity-30'
              }`}
            >
              {SCHEDULED_ITEMS.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 bg-background/50 border border-border/50 rounded transition-all duration-300 ${
                    i < visibleItems
                      ? 'opacity-100 translate-x-0'
                      : 'opacity-0 translate-x-4'
                  }`}
                >
                  <div className="w-12 text-sm font-mono text-muted-foreground">{item.day}</div>
                  <div className="flex-1 text-sm font-mono text-foreground">{item.time}</div>
                  <div
                    className={`w-7 h-7 cyber-clip-sm flex items-center justify-center border ${
                      item.platform === 'youtube'
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-pink-500/10 border-pink-500/30'
                    }`}
                  >
                    {item.platform === 'youtube' ? (
                      <SiYoutube size={14} color="#FF0000" />
                    ) : (
                      <SiInstagram size={14} color="#E4405F" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4 mt-8">
          <div className="text-center p-4">
            <div className="text-2xl font-display text-secondary mb-2">Natural Language</div>
            <p className="text-sm text-muted-foreground font-mono">
              Write it like you&apos;d tell a friend
            </p>
          </div>
          <div className="text-center p-4">
            <div className="text-2xl font-display text-secondary mb-2">Multi-Platform</div>
            <p className="text-sm text-muted-foreground font-mono">
              YouTube + Instagram in one go
            </p>
          </div>
          <div className="text-center p-4">
            <div className="text-2xl font-display text-secondary mb-2">Timezone Aware</div>
            <p className="text-sm text-muted-foreground font-mono">
              Your times, your timezone
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
