import Head from 'next/head'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { Video, Sparkles, Zap } from 'lucide-react'
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
          <div className="flex gap-4">
            {isSignedIn ? (
              <Link
                href="/projects"
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 transition-colors duration-200"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="px-6 py-2 text-muted-foreground hover:text-primary transition-colors duration-200"
                >
                  Login
                </Link>
                <Link
                  href="/sign-up"
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 transition-colors duration-200"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="mb-8 flex justify-center">
            <MonkeyLogo size="xl" showText={false} />
          </div>
          <div className="inline-block px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-semibold mb-6">
            🎉 Free Beta - No Payment Required
          </div>
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            Transform Videos into Viral Shorts
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload your long-form content and let AI find the most engaging moments.
            Create, preview, and download multiple shorts in minutes.
          </p>
          <Link
            href={isSignedIn ? '/projects' : '/sign-up'}
            className="inline-block px-8 py-4 bg-primary text-primary-foreground text-lg rounded-lg hover:bg-primary/80 transition-colors duration-200 shadow-lg"
          >
            Get Started Free
          </Link>
        </div>

        {/* Features */}
        <div className="container mx-auto px-4 py-20">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 bg-card rounded-xl shadow-sm border border-border hover:border-primary transition-colors duration-200">
              <Video className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2 text-foreground">AI-Powered Transcription</h3>
              <p className="text-muted-foreground">
                Automatic transcription using Whisper AI to understand every word in your video.
              </p>
            </div>
            <div className="p-8 bg-card rounded-xl shadow-sm border border-border hover:border-primary transition-colors duration-200">
              <Sparkles className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2 text-foreground">Smart Short Detection</h3>
              <p className="text-muted-foreground">
                GPT-5 analyzes your content and suggests the most engaging clips automatically.
              </p>
            </div>
            <div className="p-8 bg-card rounded-xl shadow-sm border border-border hover:border-primary transition-colors duration-200">
              <Zap className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2 text-foreground">Instant Preview & Download</h3>
              <p className="text-muted-foreground">
                Preview all suggested shorts and download them individually or in bulk.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="container mx-auto px-4 py-8 text-center text-muted-foreground border-t border-border">
          <p>&copy; 2024 VidEditor.ai. Built with Next.js & AI.</p>
        </footer>
      </main>
    </>
  )
}
