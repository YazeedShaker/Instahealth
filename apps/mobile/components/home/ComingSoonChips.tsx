import { Text, View } from 'react-native'

const COMING_SOON = [
  { icon: '💊', label: 'صيدليات' },
  { icon: '🏠', label: 'زيارات منزلية' },
]

// "الخدمات القادمة" chip row per the approved mockup — static, non-tappable.
export function ComingSoonChips() {
  return (
    <View className="gap-2.5">
      <Text className="font-arabic-bold text-[13px] text-ih-neutral-500">الخدمات القادمة</Text>
      <View className="flex-row gap-2.5">
        {COMING_SOON.map((item) => (
          <View
            key={item.label}
            className="flex-row items-center gap-2 rounded-ih-full border border-dashed border-ih-neutral-300 bg-ih-neutral-100 px-3.5 py-2"
            style={{ opacity: 0.75 }}
          >
            <Text className="text-[15px]" style={{ opacity: 0.6 }}>
              {item.icon}
            </Text>
            <Text className="font-arabic-semibold text-[13px] text-ih-neutral-500">
              {item.label}
            </Text>
            <Text className="text-[11px] text-ih-neutral-400">🔒</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
