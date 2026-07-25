import { toArabicDigits } from '@instahealth/core'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const GALLERY_HEIGHT = 240
const PLACEHOLDER_HEIGHT = 200

interface BranchPhotoHeaderProps {
  photos: string[]
  /** Drives the placeholder icon when the branch has no photos yet. */
  isHospital: boolean
}

// The photo gallery header from the approved mockup: swipeable photos with
// position dots + a counter chip, and the floating back control. Seeded
// branches have no photos yet — they get the styled placeholder block.
export function BranchPhotoHeader({ photos, isHospital }: BranchPhotoHeaderProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const [activeIndex, setActiveIndex] = useState(0)

  const hasPhotos = photos.length > 0
  const height = hasPhotos ? GALLERY_HEIGHT : PLACEHOLDER_HEIGHT

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1))
    setActiveIndex(Math.min(Math.max(index, 0), photos.length - 1))
  }

  return (
    <View style={{ height }} className="overflow-hidden bg-ih-neutral-200">
      {hasPhotos ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
        >
          {photos.map((photoUrl) => (
            <Image
              key={photoUrl}
              source={{ uri: photoUrl }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
              style={{ width, height }}
            />
          ))}
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center gap-2 bg-ih-primary-50">
          <Text className="text-5xl">{isHospital ? '🏥' : '🔬'}</Text>
          <Text className="font-arabic text-sm text-ih-neutral-500">
            {isHospital ? 'صورة المستشفى قريباً' : 'صورة المعمل قريباً'}
          </Text>
        </View>
      )}

      {photos.length > 1 ? (
        <>
          <View
            pointerEvents="none"
            className="absolute bottom-0 left-0 right-0 flex-row items-end justify-center gap-1.5 pb-3 pt-5"
          >
            {photos.map((photoUrl, index) => (
              <View
                key={photoUrl}
                className="h-2 rounded-ih-full"
                style={{
                  width: index === activeIndex ? 20 : 8,
                  backgroundColor: index === activeIndex ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
                }}
              />
            ))}
          </View>
          <View
            className="absolute rounded-ih-full px-3 py-0.5"
            style={{
              top: insets.top + 14,
              end: 16,
              backgroundColor: 'rgba(255,255,255,0.85)',
            }}
          >
            <Text className="font-arabic-semibold text-xs text-ih-neutral-700">
              {toArabicDigits(`${activeIndex + 1} / ${photos.length}`)}
            </Text>
          </View>
        </>
      ) : null}

      <Pressable
        testID="branch-back"
        accessibilityRole="button"
        accessibilityLabel="رجوع"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/home'))}
        className="absolute h-11 w-11 items-center justify-center rounded-ih-full bg-white/90 shadow-sm"
        style={{ top: insets.top + 14, start: 16 }}
      >
        <Text className="text-lg text-ih-neutral-700">→</Text>
      </Pressable>
    </View>
  )
}
