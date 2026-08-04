import { POPULAR_SEARCHES_AR } from '@instahealth/core'
import { Pressable, Text, View } from 'react-native'

import type { SearchCategory } from '../../features/search/types'

interface SearchEmptyStateProps {
  categories: SearchCategory[]
  onPickCategory: (slug: string) => void
  onPickSuggestion: (query: string) => void
}

// The no-results state per the approved design: calm copy, a category-browse
// grid, and «أكثر بحثاً» suggestion chips (a CURATED list — SPEC-F03 forbids
// server-side search history).
export function SearchEmptyState({
  categories,
  onPickCategory,
  onPickSuggestion,
}: SearchEmptyStateProps) {
  return (
    <View testID="search-empty" className="items-center gap-3.5 px-5 pb-4 pt-4">
      <View className="h-16 w-16 items-center justify-center rounded-ih-full bg-ih-primary-50">
        <Text className="text-[27px]">🔍</Text>
      </View>
      <View className="items-center gap-2">
        <Text className="font-arabic-bold text-[17px] text-ih-neutral-800">
          لا توجد نتائج لهذا البحث
        </Text>
        <Text className="text-center font-arabic text-[13.5px] leading-6 text-ih-neutral-600">
          تأكد من كتابة الاسم، أو تصفّح الفئات — غالباً ستجد الخدمة تحت اسم آخر.
        </Text>
      </View>

      <View className="w-full gap-2.5">
        <Text className="font-arabic-bold text-[12.5px] text-ih-neutral-500">تصفّح الفئات</Text>
        <View className="flex-row gap-2">
          {categories.map((category) => (
            <Pressable
              key={category.slug}
              testID={`search-browse-${category.slug}`}
              accessibilityRole="button"
              accessibilityLabel={category.nameAr}
              onPress={() => onPickCategory(category.slug)}
              className="flex-1 items-center gap-1.5 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0 px-2 pb-3 pt-3.5"
            >
              <View className="h-[42px] w-[42px] items-center justify-center rounded-[11px] bg-ih-primary-50">
                <Text className="text-[21px]">{category.icon}</Text>
              </View>
              <Text className="font-arabic-bold text-[13px] text-ih-neutral-800">
                {category.nameAr}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="w-full gap-2">
        <Text className="font-arabic-bold text-[12.5px] text-ih-neutral-500">أكثر بحثاً</Text>
        <View className="flex-row flex-wrap gap-2">
          {POPULAR_SEARCHES_AR.map((suggestion) => (
            <Pressable
              key={suggestion}
              accessibilityRole="button"
              onPress={() => onPickSuggestion(suggestion)}
              className="min-h-[44px] items-center justify-center rounded-ih-full border border-ih-neutral-200 bg-ih-neutral-0 px-3.5"
            >
              <Text className="font-arabic-semibold text-[13px] text-ih-neutral-700">
                {suggestion}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  )
}
