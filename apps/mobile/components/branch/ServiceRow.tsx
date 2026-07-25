import { toArabicDigits, type BranchServiceItem } from '@instahealth/core'
import { Pressable, Text, View } from 'react-native'

import { getServicePrepChip } from '../../features/branch/prep'

interface ServiceRowProps {
  service: BranchServiceItem
  isSelected: boolean
  isLast: boolean
  onToggle: (service: BranchServiceItem) => void
}

// One selectable service row from the approved mockup: checkbox, name,
// prep-indicator chip, price. Whole row is the touch target (≥44px).
export function ServiceRow({ service, isSelected, isLast, onToggle }: ServiceRowProps) {
  const prepChip = getServicePrepChip(service)

  return (
    <Pressable
      testID={`service-row-${service.id}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={service.nameAr}
      onPress={() => onToggle(service)}
      className={`min-h-[44px] flex-row items-center gap-3 px-4 py-3.5 ${
        isLast ? '' : 'border-b border-ih-neutral-100'
      } ${isSelected ? 'bg-ih-primary-50' : 'bg-ih-neutral-0'}`}
    >
      <View
        className={`h-6 w-6 items-center justify-center rounded-ih-xs border-[1.5px] ${
          isSelected
            ? 'border-ih-primary-400 bg-ih-primary-400'
            : 'border-ih-neutral-300 bg-ih-neutral-0'
        }`}
      >
        {isSelected ? <Text className="text-sm text-white">✓</Text> : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-arabic-semibold text-[15px] text-ih-neutral-800">
          {service.nameAr}
        </Text>
        {prepChip !== null ? (
          <View className="flex-row">
            <Text className="rounded-ih-full bg-ih-accent-200 px-2.5 py-0.5 font-arabic-semibold text-[11px] text-ih-primary-700">
              ⚠ {prepChip === 'fasting' ? 'يتطلب صياماً' : 'يتطلب تحضيراً'}
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="font-arabic-bold text-sm text-ih-neutral-800">
        {toArabicDigits(String(service.priceEgp))}{' '}
        <Text className="font-english text-[11px] text-ih-neutral-500">EGP</Text>
      </Text>
    </Pressable>
  )
}
