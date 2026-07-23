import 'react-native-url-polyfill/auto'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@instahealth/core'

import { env } from './env'

// The ONE Supabase client for the mobile app — anon key, RLS respected.
// AsyncStorage is injected as the session storage adapter (CORE-01 hand-off):
// this is what makes the session survive app restarts.
export const supabase = createClient({
  url: env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  storage: AsyncStorage,
})
