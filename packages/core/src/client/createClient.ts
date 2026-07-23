// Supabase client factory — the ONLY way apps create a client.
// Core never reads process.env: the apps read their own env and inject it here.

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../types/database'

/** Minimal storage contract — structurally compatible with Supabase's SupportedStorage.
 * React Native injects AsyncStorage through this; web omits it and uses the default.
 * This injection is the ONLY platform variance allowed in core. */
export interface SessionStorageAdapter {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

export interface CreateClientConfig {
  url: string
  anonKey: string
  storage?: SessionStorageAdapter
}

/** Anon-key client for BOTH apps. Respects RLS — never bypasses it. */
export function createClient(config: CreateClientConfig): SupabaseClient<Database> {
  const { url, anonKey, storage } = config
  return createSupabaseClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      ...(storage !== undefined ? { storage } : {}),
    },
  })
}
