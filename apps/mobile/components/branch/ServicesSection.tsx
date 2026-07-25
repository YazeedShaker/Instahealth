import type { BranchServiceItem, CategoryGroup } from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { Text, TextInput, View } from 'react-native'

import { filterGroupsByQuery } from '../../features/branch/serviceSearch'
import { ServiceRow } from './ServiceRow'

interface ServicesSectionProps {
  groups: CategoryGroup[]
  selectedServiceIds: Set<string>
  searchQuery: string
  onSearchChange: (query: string) => void
  onToggleService: (service: BranchServiceItem) => void
}

// Services grouped by category (DECISION-provider-data-model §1) with the thin
// in-list filter — NOT F03's global search. Grouping order comes from core.
export function ServicesSection({
  groups,
  selectedServiceIds,
  searchQuery,
  onSearchChange,
  onToggleService,
}: ServicesSectionProps) {
  const visibleGroups = filterGroupsByQuery(groups, searchQuery)

  if (groups.length === 0) {
    return (
      <View className="items-center gap-2 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0 p-6">
        <Text className="text-3xl">🗂️</Text>
        <Text className="text-center font-arabic text-sm leading-6 text-ih-neutral-600">
          لا توجد خدمات متاحة حالياً في هذا الفرع
        </Text>
      </View>
    )
  }

  return (
    <View className="gap-4">
      <View className="min-h-[44px] flex-row items-center gap-2.5 rounded-ih-sm border-[1.5px] border-ih-neutral-200 bg-ih-neutral-0 px-3.5">
        <Text className="text-sm" style={{ opacity: 0.6 }}>
          🔍
        </Text>
        <TextInput
          testID="service-search"
          accessibilityLabel="ابحث في الخدمات"
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="ابحث في الخدمات…"
          placeholderTextColor={colors.neutral[400]}
          className="flex-1 py-2 text-right font-arabic text-[14px] text-ih-neutral-800"
        />
      </View>

      {visibleGroups.length === 0 ? (
        <Text className="py-2 text-center font-arabic text-sm text-ih-neutral-500">
          لا توجد خدمات مطابقة لبحثك
        </Text>
      ) : (
        visibleGroups.map((group) => (
          <View key={group.slug} className="gap-2.5">
            <View className="flex-row items-center gap-2">
              {group.icon !== null ? <Text className="text-lg">{group.icon}</Text> : null}
              <Text className="font-arabic-bold text-base text-ih-neutral-800">{group.nameAr}</Text>
            </View>
            <View className="overflow-hidden rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0">
              {group.services.map((service, index) => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  isSelected={selectedServiceIds.has(service.id)}
                  isLast={index === group.services.length - 1}
                  onToggle={onToggleService}
                />
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  )
}
