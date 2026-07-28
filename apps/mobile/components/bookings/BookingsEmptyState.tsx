import { colors } from '@instahealth/design-tokens'
import { Text, View } from 'react-native'

import { PrimaryButton } from '../ui/PrimaryButton'

// Two different empties, because they mean different things (the design draws
// both): a patient with NO bookings at all gets the warm first-run moment and a
// way to start; the "السابقة" tab of an active patient just has nothing to show
// yet and must not nag them to book again.

export function NoBookingsYet({ onBookNow }: { onBookNow: () => void }) {
  return (
    <View
      testID="bookings-empty-new-user"
      className="flex-1 items-center justify-center gap-5 px-8 py-6"
    >
      {/* The design's illustration slot. No artwork shipped in the bundle, so
          the cream disc from the mockup carries the moment on its own rather
          than blocking on an asset. */}
      <View
        className="h-[170px] w-[170px] items-center justify-center rounded-ih-full"
        style={{ backgroundColor: 'rgba(240,243,189,0.35)' }}
      >
        <Text className="text-6xl">🗓️</Text>
      </View>
      <View className="gap-2">
        <Text className="text-center font-arabic-bold text-lg text-ih-neutral-800">
          لا توجد حجوزات بعد
        </Text>
        <Text className="text-center font-arabic text-sm leading-6 text-ih-neutral-600">
          ابدأ بحجز أول موعد لك — تحاليل، أشعة، أو كشف طبيب في دقائق.
        </Text>
      </View>
      <View className="w-full max-w-[260px]">
        <PrimaryButton testID="bookings-empty-cta" label="احجز الآن" onPress={onBookNow} />
      </View>
    </View>
  )
}

export function NoBookingsInTab({ tab }: { tab: 'upcoming' | 'past' }) {
  const isUpcoming = tab === 'upcoming'
  return (
    <View testID={`bookings-empty-${tab}`} className="items-center gap-2 px-5 py-12">
      <Text className="text-3xl">📅</Text>
      <Text className="text-center font-arabic-bold text-[15px] text-ih-neutral-700">
        {isUpcoming ? 'لا توجد حجوزات قادمة' : 'لا توجد حجوزات سابقة'}
      </Text>
      <Text
        className="text-center font-arabic text-[13px] leading-6"
        style={{ color: colors.neutral[500] }}
      >
        {isUpcoming
          ? 'مواعيدك القادمة ستظهر هنا بمجرد الحجز'
          : 'حجوزاتك المكتملة والملغاة ستظهر هنا'}
      </Text>
    </View>
  )
}
