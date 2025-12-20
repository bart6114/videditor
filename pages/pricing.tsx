import Head from 'next/head'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { MonkeyLogo } from '@/components/MonkeyLogo'
import { Check, Zap } from 'lucide-react'
import {
  CREDIT_PACKAGES,
  CREDIT_COSTS,
  DEFAULT_FREE_CREDITS,
  formatPriceWithCurrency,
  formatCreditPriceWithCurrency,
  type SupportedCurrency,
} from '@/lib/credits/constants'

export default function PricingPage() {
  const { isSignedIn } = useUser()
  const [currency, setCurrency] = useState<SupportedCurrency>('USD')

  // Detect currency from API (which uses IP geolocation)
  useEffect(() => {
    async function detectCurrency() {
      try {
        const res = await fetch('/api/v1/billing/currency')
        if (res.ok) {
          const data = await res.json()
          setCurrency(data.data?.effectiveCurrency || 'USD')
        }
      } catch {
        // Default to USD on error
      }
    }
    detectCurrency()
  }, [])

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
        <div className="fixed inset-0 circuit-grid opacity-40" />
        <div className="fixed inset-0 scanlines-subtle pointer-events-none" />

        {/* Header */}
        <nav className="relative container mx-auto px-4 py-6 flex justify-between items-center">
          <Link href="/" className="text-xl font-display uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
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
            <h1 className="text-4xl md:text-6xl font-display uppercase tracking-widest mb-6 text-primary chromatic-subtle">
              Simple Pricing
            </h1>
            <p className="text-xl text-muted-foreground font-mono max-w-2xl mx-auto">
              {'>'} Pay only for what you use. No subscriptions, no hidden fees.
            </p>
          </div>
        </div>

        {/* Pricing Card */}
        <div className="relative container mx-auto px-4 pb-20">
          <div className="max-w-lg mx-auto">
            <div className="relative cyber-clip-lg border-2 border-primary/30 overflow-hidden">
              <div className="bg-card p-8 md:p-10 scanlines-subtle">
                {/* Free credits banner */}
                <div className="bg-primary/10 border-2 border-primary/30 cyber-clip-sm p-4 mb-8 text-center">
                  <div className="flex items-center justify-center gap-2 text-primary font-mono uppercase tracking-wider mb-1">
                    <Zap className="w-5 h-5" />
                    {DEFAULT_FREE_CREDITS} Free Credits
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">
                    {'>'} Start with {DEFAULT_FREE_CREDITS} free credits when you sign up
                  </p>
                </div>

                {/* Currency toggle */}
                <div className="flex justify-center gap-2 mb-6">
                  <button
                    onClick={() => setCurrency('EUR')}
                    className={`px-3 py-1 cyber-clip-sm text-sm font-mono uppercase tracking-wider transition-colors ${
                      currency === 'EUR'
                        ? 'bg-primary text-primary-foreground border-2 border-primary'
                        : 'bg-muted text-muted-foreground border-2 border-border hover:border-primary/50'
                    }`}
                  >
                    EUR
                  </button>
                  <button
                    onClick={() => setCurrency('USD')}
                    className={`px-3 py-1 cyber-clip-sm text-sm font-mono uppercase tracking-wider transition-colors ${
                      currency === 'USD'
                        ? 'bg-primary text-primary-foreground border-2 border-primary'
                        : 'bg-muted text-muted-foreground border-2 border-border hover:border-primary/50'
                    }`}
                  >
                    USD
                  </button>
                </div>

                {/* Price per credit */}
                <div className="text-center mb-8">
                  <div className="text-5xl font-bold text-foreground mb-2">
                    {formatCreditPriceWithCurrency(currency)}
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
                <div className="border-t-2 border-border pt-6 mb-8">
                  <p className="text-sm text-muted-foreground font-mono uppercase tracking-wider mb-4">{'>'} Credit Packages</p>
                  <div className="grid grid-cols-2 gap-3">
                    {CREDIT_PACKAGES.map(({ credits }) => (
                      <div
                        key={credits}
                        className="p-3 border-2 border-border cyber-clip-sm text-center hover:border-primary/50 transition-colors"
                      >
                        <div className="font-mono font-bold text-foreground">{credits} credits</div>
                        <div className="text-sm font-mono text-primary">{formatPriceWithCurrency(credits, currency)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <Button asChild size="lg" variant="glitch" className="w-full text-lg h-14">
                  <Link href={isSignedIn ? '/projects' : '/sign-up'}>
                    {isSignedIn ? 'Go to Dashboard' : 'Get Started Free'}
                  </Link>
                </Button>

                <p className="text-sm text-muted-foreground font-mono text-center mt-4">
                  {'>'} No credit card required to start
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
