import Head from 'next/head'
import Link from 'next/link'
import { MonkeyLogo } from '@/components/MonkeyLogo'

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy - VidEditor.ai</title>
        <meta name="description" content="Learn how VidEditor.ai handles and protects your data. Privacy Policy operated by Smeets BV." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'}/privacy`} />
        <meta property="og:title" content="Privacy Policy - VidEditor.ai" />
        <meta property="og:description" content="Learn how VidEditor.ai handles and protects your data." />
        <meta property="og:image" content={`${process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'}/api/og`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="VidEditor.ai" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Privacy Policy - VidEditor.ai" />
        <meta name="twitter:description" content="Learn how VidEditor.ai handles and protects your data." />
        <meta name="twitter:image" content={`${process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'}/api/og`} />
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
          <h1 className="text-4xl font-bold mb-8 text-foreground">Privacy Policy</h1>

          <div className="prose prose-invert prose-sm max-w-none space-y-6 text-muted-foreground">
            <p className="text-sm text-muted-foreground/60">Last updated: December 2025</p>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">1. Data Controller</h2>
              <p>
                This service is operated by <strong className="text-foreground">Smeets BV</strong>, doing business as VidEditor.ai.<br />
                VAT: BE0668497472<br />
                Contact: support@videditor.ai
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">2. Data We Collect</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-foreground/90">Account information:</strong> Email address, name (provided via Clerk authentication)</li>
                <li><strong className="text-foreground/90">Video content:</strong> Videos you upload for processing</li>
                <li><strong className="text-foreground/90">Usage data:</strong> How you interact with our service</li>
                <li><strong className="text-foreground/90">Payment information:</strong> Processed securely by Stripe</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Data</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>To provide and improve our video editing service</li>
                <li>To process your videos using AI transcription and analysis</li>
                <li>To process payments and manage your account</li>
                <li>To communicate service updates when necessary</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">4. Legal Basis (GDPR Article 6)</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-foreground/90">Contract:</strong> Processing necessary to provide the service you requested</li>
                <li><strong className="text-foreground/90">Legitimate interest:</strong> Improving our service and preventing fraud</li>
                <li><strong className="text-foreground/90">Legal obligation:</strong> Compliance with applicable laws</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">5. Data Retention & Deletion</h2>
              <p>
                We retain your data for as long as your account is active. Video content is stored until you delete it or close your account.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-foreground/90">Account data:</strong> Retained while your account is active. Deleted when you close your account.</li>
                <li><strong className="text-foreground/90">Video content:</strong> Retained until you delete it or close your account.</li>
                <li><strong className="text-foreground/90">Connected social accounts (YouTube, Instagram):</strong> Platform data and access tokens are deleted immediately when you disconnect the account or close your VidEditor.ai account.</li>
              </ul>
              <p className="mt-2">
                You may request deletion of your data at any time by contacting support@videditor.ai.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">6. Your Rights (GDPR)</h2>
              <p>Under EU data protection law, you have the right to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Access your personal data</li>
                <li>Rectify inaccurate data</li>
                <li>Request erasure of your data</li>
                <li>Data portability</li>
                <li>Object to processing</li>
                <li>Lodge a complaint with a supervisory authority</li>
              </ul>
              <p>Contact us at support@videditor.ai to exercise these rights.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">7. Cookies</h2>
              <p>
                We use essential cookies for authentication and session management.
                We do not use tracking or advertising cookies.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">8. Data Security</h2>
              <p>We implement appropriate technical and organizational measures to protect your data:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-foreground/90">Encryption in transit:</strong> All data transmission uses HTTPS/TLS encryption</li>
                <li><strong className="text-foreground/90">Encryption at rest:</strong> Your data is stored in encrypted databases</li>
                <li><strong className="text-foreground/90">Access controls:</strong> Access tokens and credentials are stored securely with restricted access</li>
                <li><strong className="text-foreground/90">Secure infrastructure:</strong> We use trusted cloud providers with industry-standard security certifications</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">9. Third-Party Services</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-foreground/90">Clerk:</strong> Authentication (processes email and profile data)</li>
                <li><strong className="text-foreground/90">Stripe:</strong> Payment processing (handles payment information)</li>
                <li><strong className="text-foreground/90">Tigris:</strong> Cloud storage for video files</li>
                <li><strong className="text-foreground/90">Deepgram:</strong> AI transcription (processes audio from your videos)</li>
                <li><strong className="text-foreground/90">OpenRouter:</strong> AI analysis and content generation (processes video transcripts)</li>
                <li><strong className="text-foreground/90">PostHog:</strong> Product analytics (tracks feature usage and performance)</li>
                <li><strong className="text-foreground/90">Crisp:</strong> Live chat support (processes email and chat messages)</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">10. Social Platform Integrations (Google & Meta)</h2>
              <p>
                When you connect your YouTube or Instagram account to VidEditor.ai, we request
                minimal data from these platforms solely to enable video publishing features.
              </p>
              <p className="mt-3"><strong className="text-foreground/90">YouTube (Google)</strong></p>
              <p>VidEditor.ai uses YouTube API Services. By connecting your YouTube account, you agree to be bound by the{' '}
                <a href="https://www.youtube.com/t/terms" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>.
              </p>
              <p className="mt-2">We request the following permissions:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Upload videos to your channel</li>
                <li>Read your channel name and thumbnail (for display purposes)</li>
              </ul>
              <p className="text-sm mt-2"><strong className="text-foreground/90">Data we collect:</strong> Channel ID, channel name, and channel thumbnail URL.</p>
              <p className="text-sm mt-1"><strong className="text-foreground/90">How we use this data:</strong> Solely to display your connected channel in VidEditor.ai and to publish videos you choose to upload.</p>
              <p className="text-sm mt-1"><strong className="text-foreground/90">Revoking access:</strong> You can revoke VidEditor.ai&apos;s access to your Google account at any time by visiting the{' '}
                <a href="https://security.google.com/settings/security/permissions" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Google Security Settings</a> page
                or by disconnecting your account from VidEditor.ai settings. For more information about how Google handles your data, please review the{' '}
                <a href="https://www.google.com/policies/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.
              </p>

              <p className="mt-4"><strong className="text-foreground/90">Instagram (Meta)</strong></p>
              <p>We request the following permissions:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Read basic account information (for display purposes)</li>
                <li>Publish Reels to your account</li>
              </ul>
              <p className="text-sm mt-2"><strong className="text-foreground/90">Data we collect:</strong> User ID, username, account type, and profile picture.</p>
              <p className="text-sm mt-1"><strong className="text-foreground/90">How we use this data:</strong> Solely to display your connected account in VidEditor.ai and to publish Reels you choose to upload.</p>
              <p className="text-sm mt-1"><strong className="text-foreground/90">Revoking access:</strong> You can revoke VidEditor.ai&apos;s access by disconnecting your account from VidEditor.ai settings or via Meta&apos;s app permissions in your Instagram/Facebook settings.</p>

              <p className="mt-4"><strong className="text-foreground/90">How We Handle Your Social Platform Data</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>We only use this data to provide VidEditor.ai&apos;s user-facing publishing features</li>
                <li>We do not share, sell, or transfer your Google or Meta user data to any third parties</li>
                <li>We do not use this data for advertising, analytics, or AI/ML model training</li>
                <li>You can disconnect your accounts at any time from your account settings, which revokes our access</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">11. International Transfers</h2>
              <p>
                Your data may be processed in the EU and US. We ensure appropriate safeguards
                are in place for any international data transfers.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">12. Governing Law</h2>
              <p>
                This privacy policy is governed by Belgian law. Any disputes will be subject
                to the exclusive jurisdiction of the courts of Belgium.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">13. Contact</h2>
              <p>
                For privacy-related inquiries:<br />
                Email: support@videditor.ai<br />
                Smeets BV, Belgium
              </p>
            </section>
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
