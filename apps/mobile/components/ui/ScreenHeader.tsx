import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

// The standard screen header — back affordance, title, optional trailing slot.
//
// ⚠ EXTRACTED, NOT INVENTED. Every value here is transcribed from the pattern
// `bookings/[id]` and `confirmation` already share: a 44×44 circular back
// button (the accessible tap floor), the title at `text-lg` bold, and a
// bottom-bordered white bar over the `neutral-50` page.
//
// It exists because F08 shipped two screens that had NEITHER a header nor a
// SafeAreaView — their content ran under the status bar on a notched device.
// Hand-copying the pattern a third and fourth time was how it would drift
// (§3a), so the pattern is a component now.
//
// ⚠ THE `edges={['top']}` SafeAreaView IS THE CALLER'S JOB, not this
// component's. A header cannot know whether it sits directly under the status
// bar or beneath something else, and a SafeAreaView nested inside another one
// silently applies the inset twice.

export function ScreenHeader({
  title,
  onBack,
  fallbackHref,
  trailing,
  testID,
}: {
  title: string
  /** Defaults to `router.back()`, falling back to `fallbackHref` on a cold
   *  deep-link where there is no history to pop. */
  onBack?: () => void
  fallbackHref?: string
  trailing?: React.ReactNode
  testID?: string
}) {
  const router = useRouter()

  const goBack = () => {
    if (onBack !== undefined) return onBack()
    if (router.canGoBack()) return router.back()
    if (fallbackHref !== undefined) router.replace(fallbackHref as never)
  }

  return (
    <View className="flex-row items-center gap-3 border-b border-ih-neutral-200 bg-ih-neutral-0 px-5 pb-3.5 pt-2">
      <Pressable
        testID={testID === undefined ? 'screen-back' : `${testID}-back`}
        accessibilityRole="button"
        accessibilityLabel="رجوع"
        onPress={goBack}
        className="h-11 w-11 items-center justify-center rounded-ih-full border border-ih-neutral-200 bg-ih-neutral-50"
      >
        {/* RTL: "back" points RIGHT, toward where the previous screen came from. */}
        <Text className="text-lg text-ih-neutral-700">→</Text>
      </Pressable>
      <Text
        accessibilityRole="header"
        className="flex-1 font-arabic-bold text-lg text-ih-neutral-800"
      >
        {title}
      </Text>
      {trailing}
    </View>
  )
}
