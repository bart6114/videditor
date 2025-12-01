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
          backgroundColor: OG_COLORS.background,
          padding: '60px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Bold gradient overlays */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            left: '-100px',
            width: '600px',
            height: '600px',
            background: `radial-gradient(circle, ${OG_COLORS.primary}40, transparent 60%)`,
            filter: 'blur(60px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-150px',
            right: '-150px',
            width: '700px',
            height: '700px',
            background: `radial-gradient(circle, ${OG_COLORS.accent}35, transparent 60%)`,
            filter: 'blur(80px)',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '40px',
            }}
          >
            <div
              style={{
                fontSize: '32px',
                fontWeight: 700,
                color: OG_COLORS.primary,
                fontFamily: 'monospace',
              }}
            >
              @(&apos;_&apos;)@
            </div>
            <span
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: OG_COLORS.foreground,
                marginLeft: '16px',
              }}
            >
              VidEditor.ai
            </span>
          </div>

          {/* Main headline */}
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 700,
              color: OG_COLORS.foreground,
              lineHeight: 1.1,
              margin: 0,
              marginBottom: '12px',
              maxWidth: '900px',
            }}
          >
            {PAGE_SEO.homepage.headline}
          </h1>

          {/* Subheadline with accent */}
          <h2
            style={{
              fontSize: '72px',
              fontWeight: 700,
              background: `linear-gradient(135deg, ${OG_COLORS.primary} 0%, ${OG_COLORS.accent} 100%)`,
              backgroundClip: 'text',
              color: 'transparent',
              lineHeight: 1.1,
              margin: 0,
              marginBottom: '30px',
            }}
          >
            {PAGE_SEO.homepage.subheadline}
          </h2>

          {/* Tagline */}
          <p
            style={{
              fontSize: '28px',
              color: OG_COLORS.muted,
              margin: 0,
            }}
          >
            {PAGE_SEO.homepage.tagline}
          </p>
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Credits info */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: OG_COLORS.primaryBright,
                }}
              />
              <span style={{ color: OG_COLORS.muted, fontSize: '20px' }}>
                100 free credits
              </span>
            </div>
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: OG_COLORS.cardBorder,
              }}
            />
            <span style={{ color: OG_COLORS.muted, fontSize: '20px' }}>
              No credit card needed
            </span>
          </div>

          {/* Monkey mascot - using img tag as required by @vercel/og */}
          {/* Original image is 1408x768 (1.83:1 aspect ratio) */}
          {/* Container has 60px padding, so bottom: -60px reaches actual edge */}
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img
            src={`${appUrl}/monkey-rec.jpeg`}
            width={330}
            height={180}
            style={{
              position: 'absolute',
              bottom: '-60px',
              right: '0px',
              objectFit: 'contain',
            }}
          />
        </div>
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
