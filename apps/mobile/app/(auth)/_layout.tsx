import { Redirect, Stack } from 'expo-router'

import { useAuthStore } from '../../features/auth/store'

// Auth group — NO tab bar on any auth screen (DECISION-navigation-safe-areas §1).
// Route protection lives here, not per-screen: a signed-in user with a complete
// profile never sees auth screens. Signed-in users WITHOUT a name stay here
// for the name step.
export default function AuthLayout() {
  const status = useAuthStore((state) => state.status)
  const profile = useAuthStore((state) => state.profile)

  const hasCompleteProfile =
    profile?.name_ar !== null && profile !== null && profile.name_ar.trim().length > 0
  if (status === 'signedIn' && hasCompleteProfile) {
    return <Redirect href="/(app)/home" />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
