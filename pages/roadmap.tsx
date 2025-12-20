import Head from 'next/head'
import Link from 'next/link'
import { MonkeyLogo } from '@/components/MonkeyLogo'
import roadmapData from '@/data/roadmap.json'

type Priority = 'high' | 'medium' | 'low' | 'beta'

interface RoadmapItem {
  topic: string
  description: string
  priority: Priority
}

const priorityOrder: Record<Priority, number> = {
  beta: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const priorityStyles: Record<Priority, string> = {
  high: 'bg-primary/20 text-primary border-primary/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30',
  beta: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
}

export default function Roadmap() {
  const items = (roadmapData as RoadmapItem[]).sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  )

  return (
    <>
      <Head>
        <title>Roadmap - VidEditor.ai</title>
        <meta name="description" content="See what's coming next for VidEditor.ai" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-background dark relative">
        <div className="fixed inset-0 dot-grid opacity-40" />

        {/* Header */}
        <nav className="relative container mx-auto px-4 py-6 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-foreground hover:text-foreground/80 transition-colors">
            VidEditor.ai
          </Link>
        </nav>

        {/* Content */}
        <div className="relative container mx-auto px-4 py-16 max-w-3xl">
          <h1 className="text-4xl font-bold mb-4 text-foreground">Roadmap</h1>
          <p className="text-muted-foreground mb-12">
            Here&apos;s what we&apos;re working on and what&apos;s coming next.
          </p>

          <div className="space-y-6">
            {items.map((item, index) => (
              <div
                key={index}
                className="p-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h2 className="text-xl font-semibold text-foreground">{item.topic}</h2>
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full border ${priorityStyles[item.priority]}`}
                  >
                    {item.priority}
                  </span>
                </div>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="relative container mx-auto px-4 py-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MonkeyLogo size="sm" showText={false} />
            <span className="text-sm font-semibold text-foreground/80">VidEditor.ai</span>
          </div>
          <p className="text-sm text-muted-foreground/60 mb-2">&copy; 2025 VidEditor.ai. All rights reserved.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/privacy" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              Privacy Policy
            </Link>
            <span className="text-muted-foreground/30">·</span>
            <Link href="/terms" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              Terms of Service
            </Link>
          </div>
        </footer>
      </main>
    </>
  )
}
