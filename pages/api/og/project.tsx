import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { OG_WIDTH, OG_HEIGHT, OG_COLORS, SEO_CONFIG } from '@/lib/og/constants';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appUrl = SEO_CONFIG.siteUrl;

  // Dynamic parameters
  const title = searchParams.get('title') || 'Untitled Project';
  const shortsCount = searchParams.get('shorts') || '0';
  const duration = searchParams.get('duration') || '0:00';
  const thumbnailUrl = searchParams.get('thumbnail');

  // Truncate title if too long
  const displayTitle = title.length > 50 ? title.substring(0, 47) + '...' : title;

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
          backgroundColor: OG_COLORS.background,
          padding: '50px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Gradient overlays */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            left: '-50px',
            width: '400px',
            height: '400px',
            background: `radial-gradient(circle, ${OG_COLORS.primary}35, transparent 60%)`,
            filter: 'blur(50px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-100px',
            right: '200px',
            width: '500px',
            height: '500px',
            background: `radial-gradient(circle, ${OG_COLORS.accent}25, transparent 60%)`,
            filter: 'blur(60px)',
          }}
        />

        {/* Left side: Video thumbnail */}
        <div
          style={{
            width: '480px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '50px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '270px',
              backgroundColor: OG_COLORS.card,
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `3px solid ${OG_COLORS.primary}50`,
              boxShadow: `0 0 40px ${OG_COLORS.primary}20`,
              overflow: 'hidden',
            }}
          >
            {thumbnailUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */
              <img
                src={thumbnailUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {/* Play button */}
                <div
                  style={{
                    width: '90px',
                    height: '90px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${OG_COLORS.primary} 0%, ${OG_COLORS.primaryBright} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 30px ${OG_COLORS.primary}50`,
                  }}
                >
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '30px solid white',
                      borderTop: '18px solid transparent',
                      borderBottom: '18px solid transparent',
                      marginLeft: '8px',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side: Project info */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '30px',
            }}
          >
            <div
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: OG_COLORS.primary,
                fontFamily: 'monospace',
              }}
            >
              @(&apos;_&apos;)@
            </div>
            <span
              style={{
                fontSize: '20px',
                color: OG_COLORS.muted,
                marginLeft: '12px',
              }}
            >
              VidEditor.ai
            </span>
          </div>

          {/* Project title */}
          <h1
            style={{
              fontSize: '52px',
              fontWeight: 700,
              color: OG_COLORS.foreground,
              lineHeight: 1.15,
              margin: 0,
              marginBottom: '35px',
              maxWidth: '520px',
            }}
          >
            {displayTitle}
          </h1>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '50px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '48px',
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${OG_COLORS.primaryBright} 0%, ${OG_COLORS.primary} 100%)`,
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {shortsCount}
              </span>
              <span style={{ fontSize: '18px', color: OG_COLORS.muted }}>
                Shorts Generated
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '48px',
                  fontWeight: 700,
                  color: OG_COLORS.foreground,
                }}
              >
                {duration}
              </span>
              <span style={{ fontSize: '18px', color: OG_COLORS.muted }}>
                Duration
              </span>
            </div>
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
