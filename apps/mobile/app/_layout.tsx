import '../global.css'

import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible'
import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from '@expo-google-fonts/cairo'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { I18nManager } from 'react-native'

import { useAuthStore } from '../features/auth/store'
import { env } from '../lib/env'
import { supabase } from '../lib/supabase'

// Arabic-first: force RTL once, early, before first render (CLAUDE.md §7).
// Changing forceRTL requires an app reload — it is set here and nowhere else.
I18nManager.allowRTL(true)
I18nManager.forceRTL(true)

// Env is validated at startup — a missing EXPO_PUBLIC_* var throws a clear error here.
if (!env.EXPO_PUBLIC_SUPABASE_URL) {
  throw new Error('Environment validation failed: EXPO_PUBLIC_SUPABASE_URL missing')
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60 * 1000 } },
})

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  })
  const setSession = useAuthStore((state) => state.setSession)

  // Auth bootstrap: restore the persisted session, then track every change.
  useEffect(() => {
    let isMounted = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (isMounted) setSession(data.session)
      })
      .catch(() => {
        if (isMounted) setSession(null)
      })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [setSession])

  if (!fontsLoaded) {
    return null
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  )
}
