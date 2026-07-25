import 'react-native-url-polyfill/auto'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type SessionStorageAdapter } from '@instahealth/core'
import { Platform } from 'react-native'

import { env } from './env'

type MobileSupabaseClient = ReturnType<typeof createClient>

// SSR-safety: the storage adapter is only attached in a REAL runtime.
// - Native (iOS/Android): AsyncStorage — sessions survive restarts (CORE-01 hand-off).
// - Web with a window: Supabase's default (localStorage) — no adapter needed.
// - No window (static render / Node): NO storage — supabase-js falls back to
//   in-memory storage instead of touching `window` and crashing.
function resolveStorage(): SessionStorageAdapter | undefined {
  if (Platform.OS !== 'web') return AsyncStorage
  return undefined
}

let cachedClient: MobileSupabaseClient | null = null

function getSupabaseClient(): MobileSupabaseClient {
  if (cachedClient === null) {
    const storage = resolveStorage()
    cachedClient = createClient({
      url: env.EXPO_PUBLIC_SUPABASE_URL,
      anonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      ...(storage !== undefined ? { storage } : {}),
    })
  }
  return cachedClient
}

// LAZY client — created on first property access, not at module import, so
// merely importing this module can never crash a window-less environment.
// Call sites keep the plain `supabase.auth…` API.
export const supabase: MobileSupabaseClient = new Proxy({} as MobileSupabaseClient, {
  get(_target, property) {
    const client = getSupabaseClient()
    const value: unknown = Reflect.get(client, property, client)
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client)
    }
    return value
  },
  has(_target, property) {
    return property in getSupabaseClient()
  },
})
