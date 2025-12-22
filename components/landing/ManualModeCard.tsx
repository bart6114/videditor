'use client';

import { MousePointer2 } from 'lucide-react';

export function ManualModeCard() {
  return (
    <div className="relative container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto cyber-clip border-2 border-border bg-card p-8 text-center">
        <div className="w-12 h-12 mx-auto cyber-clip bg-muted/50 flex items-center justify-center mb-4 border border-border">
          <MousePointer2 className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-display uppercase tracking-wider text-foreground mb-3">
          Need Precise Control?
        </h3>
        <p className="text-sm text-muted-foreground font-mono leading-relaxed">
          Select exact word boundaries. Combine non-contiguous segments into one clip.
          For when you know exactly what you want.
        </p>
      </div>
    </div>
  );
}
