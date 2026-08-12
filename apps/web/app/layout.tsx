import type { Metadata } from 'next'
import localFont from 'next/font/local'

import './globals.css'
import { env } from '../lib/env'
import { Providers } from './providers'

// ⚠ LOCAL, NOT `next/font/google` — THE BUILD MUST NOT DEPEND ON A NETWORK CALL.
// `next/font/google` downloads the font files from `fonts.gstatic.com` AT BUILD
// TIME. On 2026-08-12 that fetch failed on a CI runner and the whole build went
// red with a webpack error that names nothing about networking until four
// screens down:
//
//     NextFontError: Failed to fetch `Cairo` from Google Fonts.
//
// Nothing in the diff caused it and a re-run went green, which is the worst
// shape a failure can have: non-deterministic, unrelated to the change, and
// expensive to diagnose twice. It would fail a production deploy exactly the
// same way. Arabic is the product's primary script, so a build that cannot
// reach Google is a build that cannot ship the app's typeface.
//
// The files are the SAME BINARIES the mobile app renders — copied from the
// `@expo-google-fonts/*` packages both apps already depend on — so web and
// mobile now draw from identical bytes rather than one pulling a Google subset
// and the other a package TTF. Both are SIL Open Font License; the licences sit
// beside them in `app/fonts/`.
//
// ⚠ Cairo 300 was declared and NEVER USED (no `font-light`, no
// `fontWeight: 300` anywhere in the app), so it is not vendored. Adding a
// weight here means adding the file; the browser downloads only what a page
// actually paints.
const cairo = localFont({
  variable: '--font-cairo',
  display: 'swap',
  src: [
    { path: './fonts/Cairo_400Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Cairo_500Medium.ttf', weight: '500', style: 'normal' },
    { path: './fonts/Cairo_600SemiBold.ttf', weight: '600', style: 'normal' },
    { path: './fonts/Cairo_700Bold.ttf', weight: '700', style: 'normal' },
    { path: './fonts/Cairo_800ExtraBold.ttf', weight: '800', style: 'normal' },
  ],
})

const atkinson = localFont({
  variable: '--font-atkinson',
  display: 'swap',
  src: [
    { path: './fonts/AtkinsonHyperlegible_400Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/AtkinsonHyperlegible_700Bold.ttf', weight: '700', style: 'normal' },
  ],
})

export const metadata: Metadata = {
  title: 'إنستاهيلث — InstaHealth',
  description: 'منصة الحجوزات الطبية في مصر — معامل، أشعة، وعيادات',
}

// Env is validated at module load — a missing NEXT_PUBLIC_* var fails the build loudly.
if (!env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Environment validation failed: NEXT_PUBLIC_SUPABASE_URL missing')
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} ${atkinson.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
