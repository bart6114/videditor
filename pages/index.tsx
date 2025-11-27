import Head from 'next/head'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { Video, Sparkles, Zap, Upload, Brain, Download, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MonkeyLogo } from '@/components/MonkeyLogo'

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

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 text-primary rounded-full text-sm font-semibold mb-8 shadow-glow">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              Early Access
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
              50 free shorts to start • No credit card needed to get started
            </p>
          </div>
        </div>

        {/* Why We Built This */}
        <div className="relative container mx-auto px-4 py-32 border-y border-border/50">
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

            {/* Visual mockup placeholder */}
            <div className="relative">
              <div className="absolute inset-0 glow-accent opacity-30" />
              <div className="relative gradient-border rounded-2xl p-8 bg-card/50 backdrop-blur-sm">
                <div className="aspect-video bg-muted/30 rounded-xl flex flex-col items-center justify-center border border-border/50 p-6">
                  {/* Animated video preview mockup */}
                  <div className="w-full max-w-[300px] space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Play className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="h-2 bg-muted-foreground/20 rounded-full w-3/4" />
                        <div className="h-2 bg-muted-foreground/20 rounded-full w-1/2" />
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-muted-foreground/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-accent w-2/3 rounded-full" />
                    </div>
                    <p className="text-xs text-muted-foreground/60 text-center">
                      Interface preview coming soon
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="relative container mx-auto px-4 py-32">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Pretty straightforward, actually
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto relative">
            {/* Step 1 */}
            <div className="relative text-center group">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/50 rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl flex items-center justify-center border border-primary/20">
                  <Upload className="w-12 h-12 text-primary icon-bounce" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shadow-glow">
                  1
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground">Upload Your Video</h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                Upload your long-form content. Most common formats work fine.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative text-center group">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-accent to-accent/50 rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-accent/20 to-accent/5 rounded-3xl flex items-center justify-center border border-accent/20">
                  <Brain className="w-12 h-12 text-accent icon-bounce" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-accent text-accent-foreground rounded-full flex items-center justify-center text-sm font-bold shadow-glow">
                  2
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground">AI Processes It</h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                We transcribe your video and identify segments where something&apos;s happening. It&apos;s not perfect, but it&apos;s pretty good.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative text-center group">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 rounded-3xl flex items-center justify-center border border-primary/20">
                  <Download className="w-12 h-12 text-primary icon-bounce" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shadow-glow">
                  3
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground">You Decide What to Keep</h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                Preview the suggested clips, download the ones you like. Or ignore all of them - you&apos;re in charge.
              </p>
            </div>
          </div>
        </div>

        {/* Features - Bento Grid */}
        <div className="relative container mx-auto px-4 py-32">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">What It Does</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The tools you need, without the nonsense
            </p>
          </div>

          <div className="grid md:grid-cols-6 gap-6 max-w-7xl mx-auto auto-rows-[minmax(280px,auto)]">
            {/* Transcription - Large card (spans 2 columns and 2 rows) */}
            <div className="md:col-span-4 md:row-span-2 group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 card-tilt">
              <div className="absolute inset-0 glow-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative h-full p-8 md:p-10 flex flex-col">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shrink-0">
                    <Video className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-3xl font-bold mb-3 text-foreground">Automatic Transcription</h3>
                    <p className="text-muted-foreground text-lg leading-relaxed">
                      We transcribe your entire video so the AI knows what&apos;s being said. Saves you from manually marking timestamps.
                    </p>
                  </div>
                </div>
                {/* Mockup area - Transcription */}
                <div className="flex-1 mt-4 rounded-xl bg-muted/20 border border-border/50 p-6">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="text-xs text-primary/60 font-mono mt-1">00:12</div>
                      <div className="flex-1 space-y-1">
                        <div className="h-2 bg-muted-foreground/20 rounded w-full" />
                        <div className="h-2 bg-muted-foreground/20 rounded w-5/6" />
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="text-xs text-primary/60 font-mono mt-1">00:18</div>
                      <div className="flex-1 space-y-1">
                        <div className="h-2 bg-muted-foreground/20 rounded w-3/4" />
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="text-xs text-primary/60 font-mono mt-1">00:23</div>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="h-2 bg-muted-foreground/20 rounded w-1/2" />
                        <div className="typing-dots flex gap-1">
                          <span className="w-1 h-1 bg-primary rounded-full"></span>
                          <span className="w-1 h-1 bg-primary rounded-full"></span>
                          <span className="w-1 h-1 bg-primary rounded-full"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Segment Detection - Tall card (right side, 2 rows) */}
            <div className="md:col-span-2 md:row-span-2 group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-accent/30 transition-all duration-300 card-tilt">
              <div className="absolute inset-0 glow-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative h-full p-8 flex flex-col">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-5 border border-accent/20">
                  <Sparkles className="w-7 h-7 text-accent" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-foreground">Segment Detection</h3>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Finds parts of your video where something&apos;s happening - topic changes, interesting moments, complete thoughts. Sometimes it misses. Sometimes it nails it.
                </p>
                {/* Mockup area - Timeline */}
                <div className="flex-1 rounded-xl bg-muted/20 border border-border/50 p-4">
                  <div className="space-y-3">
                    {/* Timeline visualization */}
                    <div className="space-y-2">
                      <div className="flex gap-1 h-8">
                        <div className="w-1/4 bg-accent/30 rounded border border-accent/40 flex items-center justify-center">
                          <div className="text-[8px] text-accent">Clip</div>
                        </div>
                        <div className="w-1/6 bg-muted-foreground/10 rounded" />
                        <div className="w-1/5 bg-accent/30 rounded border border-accent/40 flex items-center justify-center">
                          <div className="text-[8px] text-accent">Clip</div>
                        </div>
                        <div className="flex-1 bg-muted-foreground/10 rounded" />
                      </div>
                      <div className="flex gap-1 h-8">
                        <div className="w-1/3 bg-muted-foreground/10 rounded" />
                        <div className="w-1/4 bg-accent/30 rounded border border-accent/40 flex items-center justify-center">
                          <div className="text-[8px] text-accent">Clip</div>
                        </div>
                        <div className="flex-1 bg-muted-foreground/10 rounded" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground/60 text-center pt-2">
                      AI-detected segments
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview & Export - Wide card (full width) */}
            <div className="md:col-span-6 group relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card/50 to-primary/5 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 card-tilt">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative p-8 md:p-10">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 flex items-center justify-center mb-6 border border-primary/20">
                      <Zap className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-3xl font-bold mb-4 text-foreground">Preview & Export</h3>
                    <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                      Watch the suggested clips, download the ones you want. Works for YouTube Shorts, Instagram Reels, TikTok - standard stuff.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <div className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary font-medium">
                        YouTube Shorts
                      </div>
                      <div className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary font-medium">
                        Instagram Reels
                      </div>
                      <div className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary font-medium">
                        TikTok
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/20 border border-border/50 p-6 aspect-video flex items-center justify-center">
                    {/* Export preview grid */}
                    <div className="grid grid-cols-2 gap-3 w-full max-w-[280px]">
                      <div className="aspect-[9/16] bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg border border-primary/30 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Download className="w-6 h-6 text-primary/60" />
                        </div>
                      </div>
                      <div className="aspect-[9/16] bg-gradient-to-br from-accent/20 to-accent/5 rounded-lg border border-accent/30 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Download className="w-6 h-6 text-accent/60" />
                        </div>
                      </div>
                    </div>
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
                      <span>50 free shorts</span>
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
        <footer className="relative container mx-auto px-4 py-12 text-center border-t border-border/50">
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
