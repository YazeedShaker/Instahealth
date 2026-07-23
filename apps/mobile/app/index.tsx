import { colors } from '@instahealth/design-tokens'
import { CURRENCY, SLOT_HOLD_MINUTES } from '@instahealth/core'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

// Placeholder screen — its only job is to PROVE the foundation works:
// forced RTL, Cairo + Atkinson fonts, teal/cream via shared tokens, cross-package imports.
// Colors come through the NativeWind theme (tailwind.config.ts ← @instahealth/design-tokens).
export default function Index() {
  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-0">
      <View className="flex-1 items-start justify-center gap-4 px-6">
        {/* Arabic heading in Cairo — RTL makes this row start on the RIGHT */}
        <Text className="font-arabic-bold text-2xl text-ih-neutral-900 text-right w-full">
          إنستاهيلث — منصة الحجوزات الطبية
        </Text>

        {/* English subtitle in Atkinson Hyperlegible */}
        <Text className="font-english text-base text-ih-neutral-600 w-full text-right">
          InstaHealth — healthcare booking for Egypt
        </Text>

        {/* Cream accent element (#F0F3BD via token) */}
        <View className="w-full rounded-ih-md bg-ih-accent-300 p-4">
          <Text className="font-arabic text-sm" style={{ color: colors.primary[700] }}>
            ملاحظات التحضير تظهر هنا — لون الكريم هو بصمتنا البصرية
          </Text>
        </View>

        {/* Primary CTA using the teal token (#02C39A via token, not hardcoded) */}
        <Pressable className="w-full items-center rounded-ih-md bg-ih-primary-400 py-4">
          <Text className="font-arabic-semibold text-base text-white">احجز الآن</Text>
        </Pressable>

        {/* Proof: core package resolves from mobile */}
        <Text className="font-english text-xs text-ih-neutral-400 w-full text-right">
          core: {CURRENCY} · hold {SLOT_HOLD_MINUTES}m · tokens: {colors.primary[400]}
        </Text>
      </View>
    </SafeAreaView>
  )
}
