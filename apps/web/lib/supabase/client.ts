'use client'

import type { Database } from '@instahealth/core'
import { createBrowserClient } from '@supabase/ssr'

import { env } from '../env'

// Browser-side Supabase client. Cookie storage is handled by @supabase/ssr so
// the session the middleware refreshes and the session the browser sees are
// the SAME one — the whole reason for using the ssr package rather than
// supabase-js directly on the web.
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
