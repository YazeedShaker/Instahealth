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
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { I18nManager } from 'react-native'

import { env } from '../lib/env'

// Arabic-first: force RTL once, early, before first render (CLAUDE.md §7).
// Changing forceRTL requires an app reload — it is set here and nowhere else.
I18nManager.allowRTL(true)
I18nManager.forceRTL(true)

// Env is validated at startup — a missing EXPO_PUBLIC_* var throws a clear error here.
if (!env.EXPO_PUBLIC_SUPABASE_URL) {
  throw new Error('Environment validation failed: EXPO_PUBLIC_SUPABASE_URL missing')
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  })

  if (!fontsLoaded) {
    return null
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}
