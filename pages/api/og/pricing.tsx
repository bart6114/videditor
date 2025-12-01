import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { OG_WIDTH, OG_HEIGHT, OG_COLORS, PAGE_SEO, SEO_CONFIG } from '@/lib/og/constants';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  const appUrl = SEO_CONFIG.siteUrl;

  // Load Inter Bold from Google Fonts
  const interBold = await fetch(
    'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff'
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: OG_COLORS.background,
          padding: '60px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Bold gradient background */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '900px',
            height: '900px',
            background: `radial-gradient(circle, ${OG_COLORS.primary}30, transparent 50%)`,
            filter: 'blur(100px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '500px',
            height: '500px',
            background: `radial-gradient(circle, ${OG_COLORS.accent}25, transparent 60%)`,
            filter: 'blur(60px)',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '50px',
            }}
          >
            <div
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: OG_COLORS.primary,
                fontFamily: 'monospace',
              }}
            >
              @(&apos;_&apos;)@
            </div>
            <span
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: OG_COLORS.foreground,
                marginLeft: '14px',
              }}
            >
              VidEditor.ai
            </span>
          </div>

          {/* Main headline */}
          <h1
            style={{
              fontSize: '80px',
              fontWeight: 700,
              color: OG_COLORS.foreground,
              margin: 0,
              marginBottom: '16px',
            }}
          >
            {PAGE_SEO.pricing.headline}
          </h1>

          {/* Subheadline */}
          <p
            style={{
              fontSize: '32px',
              color: OG_COLORS.muted,
              margin: 0,
              marginBottom: '50px',
            }}
          >
            {PAGE_SEO.pricing.subheadline}
          </p>

          {/* Price card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              padding: '28px 50px',
              backgroundColor: OG_COLORS.card,
              borderRadius: '20px',
              border: `3px solid ${OG_COLORS.primary}`,
              boxShadow: `0 0 60px ${OG_COLORS.primary}30`,
            }}
          >
            <span
              style={{
                fontSize: '72px',
                fontWeight: 700,
                background: `linear-gradient(135deg, ${OG_COLORS.primaryBright} 0%, ${OG_COLORS.primary} 100%)`,
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {PAGE_SEO.pricing.price}
            </span>
            <span
              style={{
                fontSize: '28px',
                color: OG_COLORS.muted,
                marginLeft: '16px',
              }}
            >
              {PAGE_SEO.pricing.priceUnit}
            </span>
          </div>

          {/* No subscriptions badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginTop: '30px',
              padding: '12px 24px',
              backgroundColor: `${OG_COLORS.accent}20`,
              borderRadius: '30px',
              border: `2px solid ${OG_COLORS.accent}40`,
            }}
          >
            <span
              style={{
                fontSize: '20px',
                color: OG_COLORS.accentBright,
                fontWeight: 700,
              }}
            >
              No subscriptions
            </span>
          </div>
        </div>

        {/* Monkey mascot - using img tag as required by @vercel/og */}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img
          src={`${appUrl}/monkey-rec.jpeg`}
          width={80}
          height={80}
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '40px',
            borderRadius: '12px',
            border: `2px solid ${OG_COLORS.cardBorder}`,
          }}
        />
      </div>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [
        {
          name: 'Inter',
          data: interBold,
          style: 'normal',
          weight: 700,
        },
      ],
    }
  );
}
