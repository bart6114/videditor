import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { ClerkProvider, useUser } from '@clerk/nextjs'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { useEffect } from 'react'
import posthog from 'posthog-js'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

function AppContent({ Component, pageProps }: AppProps) {
  const { user } = useUser()

  useEffect(() => {
    document.body.classList.add(inter.variable, jetbrainsMono.variable)
  }, [])

  // Identify user with PostHog when logged in
  useEffect(() => {
    if (user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      })
    }
  }, [user])

  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
      <Component {...pageProps} />
    </div>
  )
}

export default function App(props: AppProps) {
  // Initialize PostHog
  useEffect(() => {
    if (typeof window !== 'undefined') {
      posthog.init('phc_412S1ZR39vYp1ARVh4EsD76iwaE1axtqmN0gojYNW2G', {
        api_host: 'https://eu.i.posthog.com',
        defaults: '2025-05-24',
        person_profiles: 'identified_only',
      })
    }
  }, [])

  return (
    <ClerkProvider {...props.pageProps}>
      <AppContent {...props} />
    </ClerkProvider>
  )
}
