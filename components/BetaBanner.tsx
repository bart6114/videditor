'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

const STORAGE_KEY = 'beta-banner-dismissed'

export function BetaBanner() {
  const [dismissed, setDismissed] = useState(true) // Start hidden to prevent flash

  useEffect(() => {
    const wasDismissed = localStorage.getItem(STORAGE_KEY) === 'true'
    setDismissed(wasDismissed)
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(STORAGE_KEY, 'true')
  }

  if (dismissed) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-2 text-sm font-mono scanlines-subtle">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex-1 text-center uppercase tracking-wider">
          <span className="font-bold chromatic-subtle">[ BETA ]</span>
          <span className="hidden sm:inline"> — Active development in progress. Check our <Link href="/roadmap" className="underline hover:no-underline text-inherit">roadmap</Link>.</span>
          <span className="sm:hidden"> — See <Link href="/roadmap" className="underline hover:no-underline text-inherit">roadmap</Link>.</span>
          <span className="font-bold ml-1">100 FREE CREDITS!</span>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 hover:bg-primary-foreground/20 cyber-clip-sm transition-colors border border-transparent hover:border-primary-foreground/30"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
