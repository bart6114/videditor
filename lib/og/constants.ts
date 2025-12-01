// OG Image dimensions (standard for social sharing)
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// Brand colors - bold and vibrant
export const OG_COLORS = {
  // Base
  background: '#0f1117',      // Deep dark
  foreground: '#ffffff',      // Pure white for contrast

  // Brand colors - vibrant
  primary: '#3db680',         // Vibrant green
  primaryBright: '#4ade80',   // Brighter green for accents
  accent: '#f97316',          // Vibrant orange
  accentBright: '#fb923c',    // Brighter orange

  // UI
  muted: '#9ca3af',           // Muted text
  card: '#1a1d24',            // Card background
  cardBorder: '#2d3139',      // Card border
};

// SEO metadata
export const SEO_CONFIG = {
  siteName: 'VidEditor.ai',
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai',
  defaultTitle: 'VidEditor.ai - Turn Long Videos Into Shorts',
  defaultDescription: 'AI handles the tedious parts - you handle the craft. Transform long-form videos into engaging shorts efficiently.',
};

// Page-specific configs
export const PAGE_SEO = {
  homepage: {
    title: 'VidEditor.ai - Turn Long Videos Into Shorts',
    description: 'AI handles the tedious parts - you handle the craft. Transform long-form videos into engaging shorts efficiently.',
    headline: 'Turn Long Videos Into Shorts',
    subheadline: 'Actually Efficiently.',
    tagline: 'AI handles the tedious parts',
  },
  pricing: {
    title: 'Simple Pricing - VidEditor.ai',
    description: 'Pay only for what you use. No subscriptions, no hidden fees. Start with 100 free credits.',
    headline: 'Simple Pricing',
    subheadline: 'Pay only for what you use',
    price: '$0.10',
    priceUnit: 'per credit',
  },
  privacy: {
    title: 'Privacy Policy - VidEditor.ai',
    description: 'Learn how VidEditor.ai handles and protects your data.',
  },
  terms: {
    title: 'Terms of Service - VidEditor.ai',
    description: 'Terms and conditions for using VidEditor.ai.',
  },
};
