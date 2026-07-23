import { colors } from '@instahealth/design-tokens'
import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

import { getAuthDestination } from '../features/auth/routing'
import { useAuthStore } from '../features/auth/store'
import { useProfile } from '../features/auth/useProfile'

// Entry: session check → route to (auth) or (app). The decision itself is a
// pure function (features/auth/routing.ts) — this screen only awaits the inputs.
export default function Index() {
  const status = useAuthStore((state) => state.status)
  const profile = useAuthStore((state) => state.profile)
  const profileQuery = useProfile()

  const waitingForSession = status === 'loading'
  const waitingForProfile = status === 'signedIn' && profile === null && !profileQuery.isError

  if (waitingForSession || waitingForProfile) {
    return (
      <View className="flex-1 items-center justify-center bg-ih-neutral-0">
        <ActivityIndicator color={colors.primary[400]} />
      </View>
    )
  }

  // Profile fetch failed while signed in (e.g. offline) → go Home; the profile
  // loads there when connectivity returns. Never strand the user on a spinner.
  if (status === 'signedIn' && profile === null) {
    return <Redirect href="/(app)/home" />
  }

  const destination = getAuthDestination({
    hasSession: status === 'signedIn',
    profileName: profile?.name_ar ?? null,
  })
  return <Redirect href={destination} />
}
