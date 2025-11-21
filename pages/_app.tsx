import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { useEffect } from 'react'

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

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    document.body.classList.add(inter.variable, jetbrainsMono.variable)
  }, [])

  return (
    <ClerkProvider {...pageProps}>
      <div className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
        <Component {...pageProps} />
      </div>
    </ClerkProvider>
  )
}
