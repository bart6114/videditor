import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { ClerkProvider } from '@clerk/nextjs'
import { JetBrains_Mono } from 'next/font/google'
import { useEffect } from 'react'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export default function App({ Component, pageProps }: AppProps) {
  // Apply font variable to body so it's available for portaled content (dialogs, etc.)
  useEffect(() => {
    document.body.classList.add(jetbrainsMono.variable)
  }, [])

  return (
    <ClerkProvider {...pageProps}>
      <div className={`${jetbrainsMono.variable} font-sans`}>
        <Component {...pageProps} />
      </div>
    </ClerkProvider>
  )
}
