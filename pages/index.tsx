import Head from 'next/head'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { Video, Scissors, Sparkles, Zap } from 'lucide-react'

export default function Home() {
  const { isSignedIn } = useUser()

  return (
    <>
      <Head>
        <title>VidEditor - AI-Powered Video Shorts Generator</title>
        <meta name="description" content="Transform your long videos into viral shorts with AI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        {/* Header */}
        <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Scissors className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold">VidEditor</h1>
          </div>
          <div className="flex gap-4">
            {isSignedIn ? (
              <Link
                href="/projects"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="px-6 py-2 text-gray-700 hover:text-blue-600 transition"
                >
                  Login
                </Link>
                <Link
                  href="/sign-up"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold mb-6">
            🎉 Free Beta - No Payment Required
          </div>
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Transform Videos into Viral Shorts
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Upload your long-form content and let AI find the most engaging moments.
            Create, preview, and download multiple shorts in minutes.
          </p>
          <Link
            href={isSignedIn ? '/projects' : '/sign-up'}
            className="inline-block px-8 py-4 bg-blue-600 text-white text-lg rounded-lg hover:bg-blue-700 transition shadow-lg"
          >
            Get Started Free
          </Link>
        </div>

        {/* Features */}
        <div className="container mx-auto px-4 py-20">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 bg-white rounded-xl shadow-sm border border-gray-100">
              <Video className="w-12 h-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">AI-Powered Transcription</h3>
              <p className="text-gray-600">
                Automatic transcription using Whisper AI to understand every word in your video.
              </p>
            </div>
            <div className="p-8 bg-white rounded-xl shadow-sm border border-gray-100">
              <Sparkles className="w-12 h-12 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Smart Short Detection</h3>
              <p className="text-gray-600">
                GPT-5 analyzes your content and suggests the most engaging clips automatically.
              </p>
            </div>
            <div className="p-8 bg-white rounded-xl shadow-sm border border-gray-100">
              <Zap className="w-12 h-12 text-yellow-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Instant Preview & Download</h3>
              <p className="text-gray-600">
                Preview all suggested shorts and download them individually or in bulk.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="container mx-auto px-4 py-8 text-center text-gray-600 border-t">
          <p>&copy; 2024 VidEditor. Built with Next.js, Supabase & AI.</p>
        </footer>
      </main>
    </>
  )
}
