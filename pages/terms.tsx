import Head from 'next/head'
import Link from 'next/link'
import { MonkeyLogo } from '@/components/MonkeyLogo'

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service - VidEditor.ai</title>
        <meta name="description" content="Terms and conditions for using VidEditor.ai. Operated by Smeets BV." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'}/terms`} />
        <meta property="og:title" content="Terms of Service - VidEditor.ai" />
        <meta property="og:description" content="Terms and conditions for using VidEditor.ai." />
        <meta property="og:image" content={`${process.env.NEXT_PUBLIC_APP_URL || 'https://videditor.ai'}/api/og`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="VidEditor.ai" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Terms of Service - VidEditor.ai" />
        <meta name="twitter:description" content="Terms and conditions for using VidEditor.ai." />
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
          <h1 className="text-4xl font-bold mb-8 text-foreground">Terms of Service</h1>

          <div className="prose prose-invert prose-sm max-w-none space-y-6 text-muted-foreground">
            <p className="text-sm text-muted-foreground/60">Last updated: December 2025</p>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">1. Agreement to Terms</h2>
              <p>
                By accessing or using VidEditor.ai, you agree to be bound by these Terms of Service.
                If you do not agree, do not use the service.
              </p>
              <p>
                This service is operated by <strong className="text-foreground">Smeets BV</strong>, doing business as VidEditor.ai.<br />
                VAT: BE0668497472
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">2. Service Description</h2>
              <p>
                VidEditor.ai is a video editing tool that uses AI to help you turn long-form videos into shorter clips.
                The service includes video upload, AI-powered transcription, moment detection, and video export.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">3. Account Registration</h2>
              <p>
                You must create an account to use the service. You are responsible for maintaining the
                confidentiality of your account and for all activities under your account.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">4. User Content & Ownership</h2>
              <p>
                <strong className="text-foreground/90">You retain all rights to your content.</strong> By uploading videos,
                you grant us a limited license to process and store them solely to provide the service.
              </p>
              <p>
                You represent that you have the necessary rights to upload and process any content you submit.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">5. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Upload illegal, harmful, or infringing content</li>
                <li>Attempt to access other users&apos; accounts or data</li>
                <li>Interfere with or disrupt the service</li>
                <li>Use the service for any unlawful purpose</li>
                <li>Reverse engineer or attempt to extract source code</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">6. Credits & Payments</h2>
              <p>
                The service operates on a credit-based system. Credits are used to process videos
                and generate shorts. Purchased credits are non-refundable except as required by law.
              </p>
              <p>
                We reserve the right to modify pricing at any time. Changes will not affect
                credits already purchased.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">7. Intellectual Property</h2>
              <p>
                The VidEditor.ai service, including its design, features, and technology, is owned by Smeets BV.
                You may not copy, modify, or distribute any part of the service without permission.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">8. Disclaimers</h2>
              <p>
                The service is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
                that the service will be uninterrupted, error-free, or meet your specific requirements.
              </p>
              <p>
                AI-generated results may not always be accurate. You are responsible for reviewing
                and approving any content before publishing.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">9. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, Smeets BV shall not be liable for any indirect,
                incidental, special, or consequential damages arising from your use of the service.
              </p>
              <p>
                Our total liability shall not exceed the amount you paid us in the 12 months
                preceding the claim.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">10. Termination</h2>
              <p>
                We may suspend or terminate your access at any time for violation of these terms.
                You may delete your account at any time. Upon termination, your right to use the
                service ceases immediately.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">11. Changes to Terms</h2>
              <p>
                We may update these terms from time to time. Continued use of the service after
                changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">12. Governing Law</h2>
              <p>
                These terms are governed by Belgian law. Any disputes will be subject to the
                exclusive jurisdiction of the courts of Belgium.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">13. Contact</h2>
              <p>
                For questions about these terms:<br />
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
