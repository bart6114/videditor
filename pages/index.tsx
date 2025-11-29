import Head from 'next/head'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { Sparkles, Upload, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MonkeyLogo } from '@/components/MonkeyLogo'
import { AppPreviewMockup } from '@/components/AppPreviewMockup'

export default function Home() {
  const { isSignedIn } = useUser()

  return (
    <>
      <Head>
        <title>VidEditor.ai - Turn Long Videos Into Shorts</title>
        <meta name="description" content="We needed to edit our long-form videos into shorter pieces. So we built this. AI handles the tedious parts - you handle the craft." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
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
          <div className="flex items-center gap-3">
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

            <p className="text-sm text-muted-foreground/70 mt-8">
              100 free credits to start • No credit card needed
            </p>
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
              Upload, process, export. That&apos;s it.
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

            {/* Export */}
            <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 card-tilt p-8 text-center">
              <div className="absolute inset-0 glow-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 flex items-center justify-center mb-5 border border-primary/20">
                  <Download className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">Export</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                  Preview clips, download what you like.
                </p>
                {/* Visual hint - platform icons */}
                <div className="flex justify-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary">YT</span>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary">IG</span>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary">TT</span>
                  </div>
                </div>
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
