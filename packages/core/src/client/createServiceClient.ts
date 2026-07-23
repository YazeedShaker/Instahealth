import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../types/database'

export interface CreateServiceClientConfig {
  url: string
  serviceRoleKey: string
}

/**
 * Service-role client — **SERVER ONLY**: API routes, server actions, and Edge
 * Functions. NEVER import this from mobile code or client components; the key
 * bypasses RLS. The `security.yml` client-secret-guard job enforces this
 * boundary in CI — this import convention is what it checks. The key is
 * injected by the caller; it never has a default and never appears in core.
 */
export function createServiceClient(config: CreateServiceClientConfig): SupabaseClient<Database> {
  const { url, serviceRoleKey } = config
  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
