import { colors } from '@instahealth/design-tokens'
import { Pressable, Text, View } from 'react-native'

import type { CategoryFilter } from '../../features/home/types'

interface CategoryGridProps {
  selected: CategoryFilter
  onSelect: (filter: CategoryFilter) => void
}

// The three category cards from the approved mockup. Labs + scans are active
// (tap toggles the provider-list filter); doctors is the approved "coming soon"
// dimmed state — non-navigating, non-tappable.
export function CategoryGrid({ selected, onSelect }: CategoryGridProps) {
  const activeCategories: { slug: Exclude<CategoryFilter, null>; icon: string; label: string }[] = [
    { slug: 'labs', icon: '🧪', label: 'تحاليل' },
    { slug: 'scans', icon: '🩻', label: 'أشعة' },
  ]

  return (
    <View className="flex-row gap-3">
      {activeCategories.map((category) => {
        const isSelected = selected === category.slug
        return (
          <Pressable
            key={category.slug}
            testID={`category-${category.slug}`}
            accessibilityRole="button"
            accessibilityLabel={category.label}
            onPress={() => onSelect(isSelected ? null : category.slug)}
            className="flex-1 items-center gap-2 rounded-ih-lg border bg-ih-neutral-0 px-2 pb-3.5 pt-4"
            style={{
              borderColor: isSelected ? colors.primary[400] : colors.neutral[200],
              borderWidth: isSelected ? 1.5 : 1,
            }}
          >
            <View className="h-12 w-12 items-center justify-center rounded-ih-md bg-ih-primary-50">
              <Text className="text-2xl">{category.icon}</Text>
            </View>
            <Text className="font-arabic-bold text-sm text-ih-neutral-800">{category.label}</Text>
          </Pressable>
        )
      })}

      {/* Doctors — coming soon, dimmed, NON-tappable */}
      <View
        testID="category-doctors-coming-soon"
        accessibilityLabel="أطباء — قريباً"
        className="flex-1 items-center gap-2 rounded-ih-lg border border-dashed border-ih-neutral-300 bg-ih-neutral-100 px-2 pb-3.5 pt-4"
        style={{ opacity: 0.6 }}
      >
        <View className="h-12 w-12 items-center justify-center rounded-ih-md bg-ih-neutral-200">
          <Text className="text-2xl" style={{ opacity: 0.6 }}>
            🩺
          </Text>
        </View>
        <Text className="font-arabic-semibold text-sm text-ih-neutral-500">أطباء 🔒</Text>
        <Text className="font-arabic text-[10px] text-ih-neutral-400">قريباً</Text>
      </View>
    </View>
  )
}
