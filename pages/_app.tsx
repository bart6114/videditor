import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { ClerkProvider, useUser } from '@clerk/nextjs'
import { Manrope, JetBrains_Mono } from 'next/font/google'
import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import posthog from 'posthog-js'
import { Toaster } from 'sonner'
import { OrganizationProvider } from '@/contexts/OrganizationContext'
import { OnboardingProvider } from '@/contexts/OnboardingContext'
import { BetaBanner } from '@/components/BetaBanner'
import { OnboardingTour, DevOnboardingTools } from '@/components/onboarding'

const CrispWithNoSSR = dynamic(() => import('@/components/crisp'), {
  ssr: false,
})

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
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
    document.body.classList.add(manrope.variable, jetbrainsMono.variable)
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
    <OrganizationProvider>
      <OnboardingProvider>
        <div className={`${manrope.variable} ${jetbrainsMono.variable} font-mono`}>
          <BetaBanner />
          <Component {...pageProps} />
          <OnboardingTour />
          <DevOnboardingTools />
          <CrispWithNoSSR
            userEmail={user?.primaryEmailAddress?.emailAddress}
            userName={user?.fullName}
          />
          <Toaster position="bottom-right" />
        </div>
      </OnboardingProvider>
    </OrganizationProvider>
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
