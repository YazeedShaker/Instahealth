import type { Metadata } from 'next'
import { Atkinson_Hyperlegible, Cairo } from 'next/font/google'

import './globals.css'
import { env } from '../lib/env'
import { Providers } from './providers'

const cairo = Cairo({
  variable: '--font-cairo',
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
})

const atkinson = Atkinson_Hyperlegible({
  variable: '--font-atkinson',
  subsets: ['latin'],
  weight: ['400', '700'],
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
