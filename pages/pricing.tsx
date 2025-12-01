import Head from 'next/head'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { MonkeyLogo } from '@/components/MonkeyLogo'
import { Check, Zap } from 'lucide-react'
import {
  CREDIT_PACKAGES,
  CREDIT_COSTS,
  DEFAULT_FREE_CREDITS,
  formatPrice,
  formatCreditPrice,
} from '@/lib/credits/constants'

export default function PricingPage() {
  const { isSignedIn } = useUser()

  return (
    <>
      <Head>
        <title>Simple Pricing - VidEditor.ai</title>
        <meta name="description" content="Pay only for what you use. No subscriptions, no hidden fees. Start with 100 free credits." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'}/pricing`} />
        <meta property="og:title" content="Simple Pricing - VidEditor.ai" />
        <meta property="og:description" content="Pay only for what you use. No subscriptions, no hidden fees. Start with 100 free credits." />
        <meta property="og:image" content={`${process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'}/api/og/pricing`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="VidEditor.ai" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Simple Pricing - VidEditor.ai" />
        <meta name="twitter:description" content="Pay only for what you use. No subscriptions, no hidden fees. Start with 100 free credits." />
        <meta name="twitter:image" content={`${process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'}/api/og/pricing`} />
      </Head>

      <main className="min-h-screen bg-background dark relative overflow-hidden">
        {/* Background effects */}
        <div className="fixed inset-0 dot-grid opacity-40" />
        <div className="fixed inset-0 mesh-gradient pointer-events-none" />

        {/* Header */}
        <nav className="relative container mx-auto px-4 py-6 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-foreground hover:text-foreground/80 transition-colors">
            VidEditor.ai
          </Link>
          <div className="flex gap-3">
            {isSignedIn ? (
              <Button asChild>
                <Link href="/projects">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link href="/sign-in">Login</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">Sign Up</Link>
                </Button>
              </>
            )}
          </div>
        </nav>

        {/* Hero */}
        <div className="relative container mx-auto px-4 py-20 text-center">
          <div className="relative z-10">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
              Simple Pricing
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Pay only for what you use. No subscriptions, no hidden fees.
            </p>
          </div>
        </div>

        {/* Pricing Card */}
        <div className="relative container mx-auto px-4 pb-20">
          <div className="max-w-lg mx-auto">
            <div className="relative gradient-border rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-br from-card/90 via-card/80 to-card/90 backdrop-blur-xl p-8 md:p-10">
                {/* Free credits banner */}
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-8 text-center">
                  <div className="flex items-center justify-center gap-2 text-primary font-semibold mb-1">
                    <Zap className="w-5 h-5" />
                    {DEFAULT_FREE_CREDITS} Free Credits
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Start with {DEFAULT_FREE_CREDITS} free credits when you sign up
                  </p>
                </div>

                {/* Price per credit */}
                <div className="text-center mb-8">
                  <div className="text-5xl font-bold text-foreground mb-2">
                    {formatCreditPrice()}
                  </div>
                  <div className="text-muted-foreground">per credit</div>
                </div>

                {/* What credits do */}
                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-3 text-foreground">
                    <Check className="w-5 h-5 text-primary shrink-0" />
                    <span>{CREDIT_COSTS.shortGeneration} credit = 1 short generated</span>
                  </div>
                  <div className="flex items-center gap-3 text-foreground">
                    <Check className="w-5 h-5 text-primary shrink-0" />
                    <span>Transcription included free</span>
                  </div>
                  <div className="flex items-center gap-3 text-foreground">
                    <Check className="w-5 h-5 text-primary shrink-0" />
                    <span>AI analysis included free</span>
                  </div>
                  <div className="flex items-center gap-3 text-foreground">
                    <Check className="w-5 h-5 text-primary shrink-0" />
                    <span>No expiration on credits</span>
                  </div>
                </div>

                {/* Credit packages */}
                <div className="border-t border-border pt-6 mb-8">
                  <p className="text-sm text-muted-foreground mb-4">Credit packages</p>
                  <div className="grid grid-cols-2 gap-3">
                    {CREDIT_PACKAGES.map(({ credits }) => (
                      <div
                        key={credits}
                        className="p-3 border border-border rounded-lg text-center"
                      >
                        <div className="font-bold text-foreground">{credits} credits</div>
                        <div className="text-sm text-primary">{formatPrice(credits)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <Button asChild size="lg" className="w-full text-lg h-14 shadow-glow">
                  <Link href={isSignedIn ? '/projects' : '/sign-up'}>
                    {isSignedIn ? 'Go to Dashboard' : 'Get Started Free'}
                  </Link>
                </Button>

                <p className="text-sm text-muted-foreground text-center mt-4">
                  No credit card required to start
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative container mx-auto px-4 py-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MonkeyLogo size="sm" showText={false} />
            <span className="text-sm font-semibold text-foreground/80">VidEditor.ai</span>
          </div>
          <p className="text-sm text-muted-foreground/60">&copy; 2025 VidEditor.ai. All rights reserved.</p>
        </footer>
      </main>
    </>
  )
}
