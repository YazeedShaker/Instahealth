import { colors } from '@instahealth/design-tokens'
import { View } from 'react-native'

function SkeletonBlock({
  width,
  height,
  radius = 6,
}: {
  width: number | `${number}%`
  height: number
  radius?: number
}) {
  return (
    <View style={{ width, height, borderRadius: radius, backgroundColor: colors.neutral[100] }} />
  )
}

// Provider-card skeletons per the approved loading mockup (static shimmer-free —
// respects reduced motion by default).
export function ProviderCardSkeletons() {
  return (
    <View className="gap-3" accessibilityLabel="جارٍ تحميل المراكز القريبة…">
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          className="gap-3 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0 p-4"
          style={{ opacity: 0.8 - index * 0.12 }}
        >
          <View className="flex-row items-center gap-2.5">
            <SkeletonBlock width={44} height={44} radius={12} />
            <View className="flex-1 gap-2">
              <SkeletonBlock width="45%" height={14} radius={7} />
              <SkeletonBlock width="25%" height={11} />
            </View>
            <SkeletonBlock width={64} height={12} />
          </View>
          <View className="flex-row gap-3.5">
            <SkeletonBlock width={64} height={11} />
            <SkeletonBlock width={96} height={11} />
          </View>
          <View className="flex-row items-center justify-between border-t border-ih-neutral-100 pt-3">
            <SkeletonBlock width={120} height={12} />
            <SkeletonBlock width={68} height={32} radius={8} />
          </View>
        </View>
      ))}
    </View>
  )
}
