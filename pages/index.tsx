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
        <title>VidEditor.ai - AI-Powered Video Shorts Generator</title>
        <meta name="description" content="Transform your long videos into viral shorts with AI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-background">
        {/* Header */}
        <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
          <MonkeyLogo size="md" linkTo="/" />
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
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="mb-8 flex justify-center animate-fade-in">
            <MonkeyLogo size="xl" showText={false} />
          </div>
          <div className="inline-block px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-semibold mb-6">
            Free Beta - No Payment Required
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
            Transform Videos into Viral Shorts
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload your long-form content and let AI find the most engaging moments.
            Create, preview, and download multiple shorts in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8">
              <Link href={isSignedIn ? '/projects' : '/sign-up'}>
                Get Started Free
              </Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            No credit card required • Cancel anytime
          </p>
        </div>

        {/* Social Proof */}
        <div className="container mx-auto px-4 py-12 border-y border-border">
          <p className="text-center text-muted-foreground mb-6">Works with your favorite platforms</p>
          <div className="flex justify-center items-center gap-12 flex-wrap">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Play className="w-6 h-6" />
              <span className="font-semibold">YouTube</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Video className="w-6 h-6" />
              <span className="font-semibold">TikTok</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="w-6 h-6" />
              <span className="font-semibold">Instagram</span>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="container mx-auto px-4 py-20">
          <h2 className="text-3xl font-bold text-center mb-4 text-foreground">How It Works</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Three simple steps to transform your content
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div className="text-sm font-bold text-primary mb-2">Step 1</div>
              <h3 className="text-lg font-bold mb-2 text-foreground">Upload Your Video</h3>
              <p className="text-muted-foreground text-sm">
                Drop your long-form video. We support all major formats.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <div className="text-sm font-bold text-primary mb-2">Step 2</div>
              <h3 className="text-lg font-bold mb-2 text-foreground">AI Finds the Best Moments</h3>
              <p className="text-muted-foreground text-sm">
                Our AI transcribes and analyzes your content to find viral-worthy clips.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-primary" />
              </div>
              <div className="text-sm font-bold text-primary mb-2">Step 3</div>
              <h3 className="text-lg font-bold mb-2 text-foreground">Download Your Shorts</h3>
              <p className="text-muted-foreground text-sm">
                Preview, edit, and download your shorts ready for any platform.
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="container mx-auto px-4 py-20 bg-muted/30">
          <h2 className="text-3xl font-bold text-center mb-4 text-foreground">Powerful Features</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Everything you need to create engaging shorts
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 bg-card rounded-xl shadow-sm border border-border hover:border-primary hover:shadow-md transition-all duration-200 hover:-translate-y-1">
              <Video className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2 text-foreground">AI-Powered Transcription</h3>
              <p className="text-muted-foreground">
                Automatic transcription to understand every word in your video with high accuracy.
              </p>
            </div>
            <div className="p-8 bg-card rounded-xl shadow-sm border border-border hover:border-primary hover:shadow-md transition-all duration-200 hover:-translate-y-1">
              <Sparkles className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2 text-foreground">Smart Short Detection</h3>
              <p className="text-muted-foreground">
                AI analyzes your content to find the most engaging moments and suggests viral-worthy clips automatically.
              </p>
            </div>
            <div className="p-8 bg-card rounded-xl shadow-sm border border-border hover:border-primary hover:shadow-md transition-all duration-200 hover:-translate-y-1">
              <Zap className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2 text-foreground">Instant Preview & Download</h3>
              <p className="text-muted-foreground">
                Preview all suggested shorts and download them individually or in bulk.
              </p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="container mx-auto px-4 py-20">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-2xl p-12 text-center">
            <h2 className="text-3xl font-bold mb-4 text-foreground">Ready to Create Viral Shorts?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join creators who are saving hours on content repurposing. Start free during our beta.
            </p>
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link href={isSignedIn ? '/projects' : '/sign-up'}>
                Get Started Free
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              No credit card required
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="container mx-auto px-4 py-8 text-center text-muted-foreground border-t border-border">
          <p>&copy; 2025 VidEditor.ai. All rights reserved.</p>
        </footer>
      </main>
    </>
  )
}
