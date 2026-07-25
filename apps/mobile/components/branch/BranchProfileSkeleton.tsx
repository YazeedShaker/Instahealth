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

// Branch-profile loading state per the approved mockup (static shimmer-free —
// respects reduced motion by default, same approach as Home's skeletons).
export function BranchProfileSkeleton() {
  return (
    <View className="flex-1" accessibilityLabel="جارٍ تحميل بيانات المركز…">
      <View className="h-[200px] bg-ih-neutral-200" />
      <View className="gap-3 border-b border-ih-neutral-200 bg-ih-neutral-0 px-5 py-[18px]">
        <View className="flex-row items-center justify-between">
          <SkeletonBlock width={140} height={20} radius={8} />
          <SkeletonBlock width={80} height={22} radius={999} />
        </View>
        <View className="flex-row gap-3.5">
          <SkeletonBlock width={90} height={12} />
          <SkeletonBlock width={80} height={12} />
          <SkeletonBlock width={50} height={12} />
        </View>
      </View>
      <View className="gap-4 p-5">
        <View className="h-[76px] rounded-ih-sm bg-ih-accent-200" style={{ opacity: 0.6 }} />
        <SkeletonBlock width={100} height={16} radius={8} />
        <View className="overflow-hidden rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0">
          {(['55%', '35%', '45%', '40%', '60%', '38%'] as const).map((rowWidth, index) => (
            <View
              key={index}
              className={`flex-row items-center gap-3 px-4 py-3.5 ${
                index === 5 ? '' : 'border-b border-ih-neutral-100'
              }`}
              style={{ opacity: 0.9 - index * 0.08 }}
            >
              <SkeletonBlock width={24} height={24} />
              <View className="flex-1">
                <SkeletonBlock width={rowWidth} height={13} />
              </View>
              <SkeletonBlock width={60} height={13} />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
