import type { Database } from '@instahealth/core'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { env } from '../env'

// Server-side client for Server Components, Route Handlers and Server Actions.
// ANON KEY ONLY — RLS and the SECURITY DEFINER membership checks are what scope
// a receptionist to their branch. The service-role key must never appear here
// (CLAUDE.md §8); it would bypass every one of those checks.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Harmless: the middleware refreshes the session on every request,
            // so the write it could not do here has already happened there.
          }
        },
      },
    },
  )
}
