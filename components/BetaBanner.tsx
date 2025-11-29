'use client'

import { useState, useEffect } from 'react'
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
    <div className="bg-primary text-primary-foreground px-4 py-2 text-sm">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex-1 text-center">
          <span className="font-semibold">We&apos;re in Beta!</span>
          <span className="hidden sm:inline"> — We&apos;re actively developing, bugs may pop up, new features are coming.</span>
          <span className="sm:hidden"> — Bugs may pop up, features are coming.</span>
          <span className="font-semibold ml-1">You get 100 free credits!</span>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 hover:bg-primary-foreground/20 rounded transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
