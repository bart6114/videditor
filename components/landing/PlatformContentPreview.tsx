'use client';

import { SiYoutube, SiInstagram, SiTiktok } from '@icons-pack/react-simple-icons';

const PLATFORM_CONTENT = {
  youtube: {
    icon: SiYoutube,
    color: '#FF0000',
    bgClass: 'bg-red-500/10 border-red-500/30',
    title: 'The Key Insight That Changes Everything',
    description:
      'In this clip, we break down the fundamental shift happening in how people approach this problem. Understanding this one concept will transform your perspective.\n\n#insights #productivity #mindset',
  },
  instagram: {
    icon: SiInstagram,
    color: '#E4405F',
    bgClass: 'bg-pink-500/10 border-pink-500/30',
    caption:
      'This changes everything. Drop a comment if you agree!\n\n#reels #viral #motivation #success #entrepreneur',
  },
  tiktok: {
    icon: SiTiktok,
    color: '#00d4ff',
    bgClass: 'bg-accent/10 border-accent/30',
    caption:
      'POV: You finally understand the key insight everyone misses\n\n#fyp #viral #mindset #entrepreneur #success',
  },
};

export function PlatformContentPreview() {
  return (
    <div className="relative container mx-auto px-4 py-32">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-display uppercase tracking-widest mb-4 text-primary">
          Platform-Specific Content
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Same clip, optimized for each platform. AI generates tailored titles, descriptions, and captions.
        </p>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {/* YouTube */}
          <div className="cyber-clip border-2 border-border bg-card p-6 hover:border-red-500/50 transition-all duration-300">
            <div className="flex items-center gap-2 mb-4">
              <div
                className={`w-10 h-10 cyber-clip-sm flex items-center justify-center border ${PLATFORM_CONTENT.youtube.bgClass}`}
              >
                <SiYoutube size={20} color={PLATFORM_CONTENT.youtube.color} />
              </div>
              <span className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
                YouTube
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs font-mono text-muted-foreground/60 uppercase mb-1">
                  Title
                </div>
                <div className="text-sm font-medium text-foreground">
                  {PLATFORM_CONTENT.youtube.title}
                </div>
              </div>
              <div>
                <div className="text-xs font-mono text-muted-foreground/60 uppercase mb-1">
                  Description
                </div>
                <div className="text-xs text-muted-foreground font-mono whitespace-pre-line">
                  {PLATFORM_CONTENT.youtube.description}
                </div>
              </div>
            </div>
          </div>

          {/* Instagram */}
          <div className="cyber-clip border-2 border-border bg-card p-6 hover:border-pink-500/50 transition-all duration-300">
            <div className="flex items-center gap-2 mb-4">
              <div
                className={`w-10 h-10 cyber-clip-sm flex items-center justify-center border ${PLATFORM_CONTENT.instagram.bgClass}`}
              >
                <SiInstagram size={20} color={PLATFORM_CONTENT.instagram.color} />
              </div>
              <span className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
                Instagram
              </span>
            </div>

            <div>
              <div className="text-xs font-mono text-muted-foreground/60 uppercase mb-1">
                Caption
              </div>
              <div className="text-sm text-muted-foreground font-mono whitespace-pre-line">
                {PLATFORM_CONTENT.instagram.caption}
              </div>
            </div>
          </div>

          {/* TikTok */}
          <div className="cyber-clip border-2 border-border bg-card p-6 hover:border-accent/50 transition-all duration-300">
            <div className="flex items-center gap-2 mb-4">
              <div
                className={`w-10 h-10 cyber-clip-sm flex items-center justify-center border ${PLATFORM_CONTENT.tiktok.bgClass}`}
              >
                <SiTiktok size={20} className="text-accent" />
              </div>
              <span className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
                TikTok
              </span>
            </div>

            <div>
              <div className="text-xs font-mono text-muted-foreground/60 uppercase mb-1">
                Caption
              </div>
              <div className="text-sm text-muted-foreground font-mono whitespace-pre-line">
                {PLATFORM_CONTENT.tiktok.caption}
              </div>
            </div>
          </div>
        </div>

        {/* Feature note */}
        <div className="text-center mt-8 text-sm font-mono text-muted-foreground/60">
          {'>'} Edit any generated content before publishing
        </div>
      </div>
    </div>
  );
}
