import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { Sparkles, Upload, Download, ArrowRight, Calendar } from 'lucide-react'
import { SiYoutube, SiInstagram, SiTiktok } from '@icons-pack/react-simple-icons'
import { Button } from '@/components/ui/button'
import { MonkeyLogo } from '@/components/MonkeyLogo'
import { AppPreviewMockup } from '@/components/AppPreviewMockup'

export default function Home() {
  const { isSignedIn } = useUser()

  return (
    <>
      <Head>
        <title>VidEditor.ai - Turn Long Videos Into Shorts</title>
        <meta name="description" content="AI handles the tedious parts - you handle the craft. Transform long-form videos into engaging shorts efficiently." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'} />
        <meta property="og:title" content="VidEditor.ai - Turn Long Videos Into Shorts" />
        <meta property="og:description" content="AI handles the tedious parts - you handle the craft. Transform long-form videos into engaging shorts efficiently." />
        <meta property="og:image" content={`${process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'}/api/og`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="VidEditor.ai" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="VidEditor.ai - Turn Long Videos Into Shorts" />
        <meta name="twitter:description" content="AI handles the tedious parts - you handle the craft. Transform long-form videos into engaging shorts efficiently." />
        <meta name="twitter:image" content={`${process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'}/api/og`} />

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'WebSite',
                  '@id': 'https://videditor.ai/#website',
                  url: 'https://videditor.ai',
                  name: 'VidEditor.ai',
                  description: 'AI-powered video editing tool that turns long-form videos into engaging shorts',
                  publisher: {
                    '@id': 'https://videditor.ai/#organization',
                  },
                },
                {
                  '@type': 'Organization',
                  '@id': 'https://videditor.ai/#organization',
                  name: 'VidEditor.ai',
                  legalName: 'Smeets BV',
                  url: 'https://videditor.ai',
                  logo: {
                    '@type': 'ImageObject',
                    url: 'https://videditor.ai/logo.png',
                  },
                  sameAs: [],
                },
                {
                  '@type': 'SoftwareApplication',
                  name: 'VidEditor.ai',
                  applicationCategory: 'MultimediaApplication',
                  operatingSystem: 'Web',
                  offers: {
                    '@type': 'Offer',
                    price: '0',
                    priceCurrency: 'USD',
                    description: '100 free credits to start',
                  },
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: '5',
                    ratingCount: '1',
                  },
                  description: 'AI-powered tool that transforms long-form videos into engaging short-form content. Features include automatic transcription, AI moment detection, and one-click video export.',
                  featureList: [
                    'AI-powered transcription',
                    'Automatic moment detection',
                    'One-click video export',
                    'Multi-platform support (YouTube, TikTok, Instagram)',
                  ],
                },
              ],
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-background dark relative overflow-hidden">
        {/* Background effects */}
        <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" />
        <div className="fixed inset-0 mesh-gradient pointer-events-none" />

        {/* Monkey image - large screens only, fixed to bottom */}
        <div className="hidden lg:block fixed bottom-0 right-0 pointer-events-none z-10">
          <Image
            src="/monkey-rec.jpeg"
            alt="Monkey mascot"
            width={400}
            height={400}
            className="object-contain"
            style={{ height: 'auto' }}
            priority
          />
        </div>

        {/* Header */}
        <nav className="relative container mx-auto px-4 py-6 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-foreground hover:text-foreground/80 transition-colors">
            VidEditor.ai
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link href="/roadmap">Roadmap</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/pricing">Pricing</Link>
            </Button>
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

        {/* Hero Section */}
        <div className="relative container mx-auto px-4 py-32 md:py-40 text-center">
          {/* Glow effect behind content */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[600px] h-[600px] glow-primary opacity-50" />
          </div>

          <div className="relative z-10">
            <div className="mb-12 flex justify-center animate-fade-in">
              <div className="relative float">
                <div className="absolute inset-0 blur-2xl opacity-30 bg-primary" />
                <MonkeyLogo size="xl" showText={false} className="relative" />
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-[1.1] bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent max-w-5xl mx-auto">
              Edit Your Long Videos Into Shorts.{' '}
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Actually Efficiently.
              </span>
            </h1>

            <div className="max-w-3xl mx-auto space-y-4 mb-12">
              <p className="text-xl md:text-2xl text-muted-foreground/90 font-light leading-relaxed">
                We had hours of content that needed to be cut into shorter pieces. The editing process was tedious.
              </p>
              <p className="text-xl md:text-2xl text-muted-foreground/90 font-light leading-relaxed">
                So we built this. AI handles the boring parts (transcription, finding moments where things happen).
                You handle the craft - deciding what&apos;s actually worth sharing.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button asChild size="lg" className="text-lg px-10 h-14 shadow-glow hover:shadow-glow hover:scale-[1.02] transition-all">
                <Link href={isSignedIn ? '/projects' : '/sign-up'}>
                  Try It Out
                </Link>
              </Button>
            </div>

            <div className="flex items-center justify-center gap-3 mt-8">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-primary/30 bg-primary/10 text-primary/90 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                100 free credits
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400/90 backdrop-blur-sm">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                No credit card needed
              </span>
            </div>
          </div>
        </div>

        {/* Why We Built This */}
        <div className="relative container mx-auto px-4 py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-7xl mx-auto">
            {/* Content */}
            <div className="space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
                What This Actually Is
              </h2>
              <div className="space-y-5 text-lg text-muted-foreground leading-relaxed">
                <p>
                  We believe in <span className="text-foreground font-medium">authentic content</span>. The kind that comes from real people with something to say.
                </p>
                <p>
                  But if you&apos;re creating long-form videos - whether it&apos;s interviews, tutorials, or just documenting what you&apos;re working on -
                  turning that into shorter, platform-ready pieces is time-consuming. Really time-consuming.
                </p>
                <p>
                  This tool doesn&apos;t try to replace the creative decisions. It handles the tedious parts - transcribing your video,
                  identifying segments where something&apos;s actually happening, and cutting them out.
                  You still decide what&apos;s worth publishing.
                </p>
                <p className="text-xl font-medium bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent pt-2">
                  AI augments your workflow. You stay in control of your voice.
                </p>
                <div className="pt-6 mt-6 border-t border-border/30">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    <span className="mr-1.5">🎯</span>What&apos;s not our focus:
                  </p>
                  <p className="text-sm text-muted-foreground/70">
                    Timeline editing · Color grading · Audio mixing · Aspect ratio conversion
                  </p>
                </div>
              </div>
            </div>

            {/* App Preview Mockup */}
            <AppPreviewMockup />
          </div>
        </div>

        {/* The Process */}
        <div className="relative container mx-auto px-4 py-32">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">The Process</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start with an edited 9:16 video*. Get shorts ready to post.
            </p>
            <p className="text-sm text-muted-foreground/60 mt-2">
              *9:16 works best on most short-format platforms, but any aspect ratio works
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Upload */}
            <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 card-tilt p-8 text-center">
              <div className="absolute inset-0 glow-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-5 border border-primary/20">
                  <Upload className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">Upload</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Drop your long-form video. Most formats work.
                </p>
              </div>
            </div>

            {/* AI Processing */}
            <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-accent/30 transition-all duration-300 card-tilt p-8 text-center">
              <div className="absolute inset-0 glow-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-5 border border-accent/20">
                  <Sparkles className="w-7 h-7 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">AI Finds Moments</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                  Transcribes everything, then finds the interesting parts.
                </p>
                {/* Visual hint - timeline */}
                <div className="flex gap-1 h-5 max-w-[140px] mx-auto">
                  <div className="w-1/4 bg-accent/25 rounded border border-accent/30" />
                  <div className="w-1/6 bg-muted-foreground/10 rounded" />
                  <div className="w-1/4 bg-accent/25 rounded border border-accent/30" />
                  <div className="flex-1 bg-muted-foreground/10 rounded" />
                </div>
              </div>
            </div>

            {/* Share */}
            <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 card-tilt p-8 text-center">
              <div className="absolute inset-0 glow-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 flex items-center justify-center mb-5 border border-primary/20">
                  <Download className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">Share</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                  Download clips or publish directly to platforms.
                </p>
                {/* Visual hint - platform icons */}
                <div className="flex justify-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <SiYoutube size={12} className="text-primary" />
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <SiInstagram size={12} className="text-primary" />
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <SiTiktok size={12} className="text-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule & Publish */}
        <div className="relative container mx-auto px-4 py-32">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">Schedule & Publish</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Publish your shorts directly to social platforms, or schedule them using natural language.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* YouTube */}
            <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-red-500/30 transition-all duration-300 card-tilt p-8 text-center">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'radial-gradient(circle at center, rgba(255, 0, 0, 0.1), transparent 70%)' }} />
              <div className="relative flex flex-col h-full">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center mb-5 border border-red-500/20">
                  <SiYoutube size={28} color="#FF0000" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">YouTube</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4 flex-grow">
                  Publish YouTube Shorts directly. Available to all users.
                </p>
                <span className="inline-block self-center px-3 py-1 text-xs font-medium rounded-full border bg-green-500/20 text-green-400 border-green-500/30">
                  open beta
                </span>
              </div>
            </div>

            {/* Instagram */}
            <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-pink-500/30 transition-all duration-300 card-tilt p-8 text-center">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'radial-gradient(circle at center, rgba(228, 64, 95, 0.1), transparent 70%)' }} />
              <div className="relative flex flex-col h-full">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-orange-500/10 flex items-center justify-center mb-5 border border-pink-500/20">
                  <SiInstagram size={28} color="#E4405F" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">Instagram</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4 flex-grow">
                  Publish Reels directly. Currently available to selected beta users.
                </p>
                <span className="inline-block self-center px-3 py-1 text-xs font-medium rounded-full border bg-purple-500/20 text-purple-400 border-purple-500/30">
                  closed beta
                </span>
              </div>
            </div>

            {/* TikTok */}
            <Link href="/roadmap" className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-foreground/30 transition-all duration-300 card-tilt p-8 text-center block">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.05), transparent 70%)' }} />
              <div className="relative flex flex-col h-full">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-foreground/10 flex items-center justify-center mb-5 border border-foreground/20">
                  <SiTiktok size={28} className="text-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">TikTok</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4 flex-grow">
                  Coming after YouTube and Instagram are live.
                </p>
                <span className="inline-flex self-center items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border bg-amber-500/20 text-amber-400 border-amber-500/30">
                  roadmap
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
          </div>

          {/* AI Scheduling Card */}
          <div className="mt-6 max-w-4xl mx-auto">
            <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 p-8">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.1), transparent 70%)' }} />
              <div className="relative flex flex-col md:flex-row md:items-center gap-6">
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Calendar size={28} className="text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2 text-foreground">AI-Powered Scheduling</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                    Describe your schedule in plain English and let AI handle the rest.
                  </p>
                  <div className="inline-block px-4 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm text-muted-foreground italic">
                    &ldquo;Publish these shorts across the next five days, prefer mornings between 7 and 9am&rdquo;
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon / Roadmap Teaser */}
        <div className="relative container mx-auto px-4 py-20">
          <div className="max-w-3xl mx-auto">
            <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm p-8 md:p-10">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

              <div className="relative flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
                <div className="flex-1 space-y-3">
                  <h3 className="text-2xl font-bold text-foreground">What&apos;s Coming</h3>
                  <p className="text-muted-foreground">
                    We&apos;re actively building new features. Check out what&apos;s on our roadmap and what we&apos;re working on next.
                  </p>
                </div>

                <Link
                  href="/roadmap"
                  className="group inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
                >
                  View roadmap
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="relative container mx-auto px-4 py-32">
          <div className="relative max-w-5xl mx-auto">
            {/* Gradient glow background */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-3xl opacity-30" />

            <div className="relative gradient-border rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-br from-card/90 via-card/80 to-card/90 backdrop-blur-xl p-12 md:p-16 text-center">
                {/* Mesh gradient overlay */}
                <div className="absolute inset-0 mesh-gradient opacity-50" />

                <div className="relative z-10">
                  <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                    <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                      Worth a Try?
                    </span>
                  </h2>

                  <p className="text-xl md:text-2xl text-muted-foreground/90 mb-4 max-w-2xl mx-auto font-light leading-relaxed">
                    If you have long-form videos that need to be cut into shorter pieces, this might save you some time.
                  </p>

                  <p className="text-lg text-muted-foreground/70 mb-10 max-w-xl mx-auto">
                    We&apos;re still working out the kinks, but it works pretty well.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                    <Button asChild size="lg" className="text-lg px-12 h-16 shadow-glow hover:shadow-glow hover:scale-[1.02] transition-all">
                      <Link href={isSignedIn ? '/projects' : '/sign-up'}>
                        Give It a Shot
                      </Link>
                    </Button>
                  </div>

                  <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground/60 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>100 free credits</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>No credit card to start</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>No subscriptions</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 max-w-4xl mx-auto">
            {/* Left: Logo & Copyright */}
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="flex items-center gap-2">
                <MonkeyLogo size="sm" showText={false} />
                <span className="text-sm font-semibold text-foreground/80">VidEditor.ai</span>
              </div>
              <p className="text-xs text-muted-foreground/50">&copy; 2025 VidEditor.ai</p>
            </div>

            {/* Center: Links */}
            <div className="flex items-center gap-3">
              <Link href="/roadmap" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                Roadmap
              </Link>
              <span className="text-muted-foreground/30">·</span>
              <Link href="/privacy" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                Privacy
              </Link>
              <span className="text-muted-foreground/30">·</span>
              <Link href="/terms" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                Terms
              </Link>
            </div>

            {/* Right: Product Hunt */}
            <a
              href="https://www.producthunt.com/products/videditor-ai?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-videditor-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-80 hover:opacity-100 transition-opacity"
            >
              <img
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1051261&theme=dark&t=1765974184548"
                alt="VidEditor.ai - Turn long videos into shorts | Product Hunt"
                width={200}
                height={43}
              />
            </a>
          </div>
        </footer>
      </main>
    </>
  )
}
