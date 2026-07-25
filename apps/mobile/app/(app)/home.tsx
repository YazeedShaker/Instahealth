import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors } from '@instahealth/design-tokens'

import { CategoryGrid } from '../../components/home/CategoryGrid'
import { ComingSoonChips } from '../../components/home/ComingSoonChips'
import { EmptyState } from '../../components/home/EmptyState'
import { HomeHeader } from '../../components/home/HomeHeader'
import { HomeSearchBar } from '../../components/home/HomeSearchBar'
import { ProviderCardSkeletons } from '../../components/home/HomeSkeletons'
import { ProviderCard } from '../../components/home/ProviderCard'
import { useAuthStore } from '../../features/auth/store'
import { useProfile } from '../../features/auth/useProfile'
import { useFirstAvailableSlots, useHomeBranches } from '../../features/home/queries'
import { sortBranchesForDisplay } from '../../features/home/sort'
import type { CategoryFilter } from '../../features/home/types'
import { useUserLocation } from '../../features/home/useUserLocation'

// Home & Discovery (F02) — built to the approved Home mockup. Everything on
// this screen renders from the DB; there is no hardcoded provider data.
export default function Home() {
  const profile = useAuthStore((state) => state.profile)
  useProfile()

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(null)
  const { permission, location, requestLocation, dismissPrompt } = useUserLocation()
  const branchesQuery = useHomeBranches()

  const branches = useMemo(() => branchesQuery.data ?? [], [branchesQuery.data])
  const filteredBranches = useMemo(
    () =>
      categoryFilter === null
        ? branches
        : branches.filter((branch) => branch.categorySlugs.includes(categoryFilter)),
    [branches, categoryFilter],
  )
  const sortedBranches = useMemo(
    () => sortBranchesForDisplay(filteredBranches, location.coords),
    [filteredBranches, location.coords],
  )

  const slotsQuery = useFirstAvailableSlots(branches.map((branch) => branch.id))
  const now = new Date()
  const greetingName = profile?.name_ar?.trim().split(/\s+/)[0] ?? null
  const isLoading = branchesQuery.isPending

  const handleRefresh = () => {
    void branchesQuery.refetch()
    void slotsQuery.refetch()
  }

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-50" edges={['top']}>
      <FlatList
        testID="home-list"
        data={isLoading ? [] : sortedBranches}
        keyExtractor={(branch) => branch.id}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={branchesQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary[400]}
          />
        }
        ListHeaderComponent={
          <View className="gap-6 pb-3">
            <HomeHeader greetingName={greetingName} areaLabel={location.areaLabel} />
            <HomeSearchBar />
            <CategoryGrid selected={categoryFilter} onSelect={setCategoryFilter} />
            <ComingSoonChips />

            {permission === 'prompt' ? (
              <View className="gap-3 rounded-ih-md bg-ih-accent-300/35 p-4">
                <Text className="font-arabic text-sm leading-6 text-ih-primary-700">
                  نستخدم موقعك لعرض أقرب المراكز إليك — لن نشاركه مع أي جهة.
                </Text>
                <View className="flex-row gap-2.5">
                  <Pressable
                    testID="location-allow"
                    accessibilityRole="button"
                    onPress={() => void requestLocation()}
                    className="h-10 items-center justify-center rounded-ih-sm bg-ih-primary-400 px-5"
                  >
                    <Text className="font-arabic-semibold text-sm text-white">تفعيل الموقع</Text>
                  </Pressable>
                  <Pressable
                    testID="location-later"
                    accessibilityRole="button"
                    onPress={dismissPrompt}
                    className="h-10 items-center justify-center px-4"
                  >
                    <Text className="font-arabic-semibold text-sm text-ih-neutral-600">لاحقاً</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <Text className="font-arabic-bold text-[17px] text-ih-neutral-800">
              أقرب المراكز إليك
            </Text>
            {isLoading ? <ProviderCardSkeletons /> : null}
            {branchesQuery.isError ? (
              <View className="gap-3 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0 p-4">
                <Text className="font-arabic text-sm text-ih-neutral-700">
                  تعذر تحميل المراكز — تحقق من الاتصال وحاول مرة أخرى.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleRefresh}
                  className="h-10 items-center justify-center rounded-ih-sm border border-ih-neutral-200"
                >
                  <Text className="font-arabic-semibold text-sm text-ih-neutral-700">
                    إعادة المحاولة
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !isLoading && !branchesQuery.isError ? (
            <EmptyState
              hasActiveFilter={categoryFilter !== null}
              onClearFilter={() => setCategoryFilter(null)}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ProviderCard branch={item} firstSlot={slotsQuery.data?.get(item.id) ?? null} now={now} />
        )}
      />
    </SafeAreaView>
  )
}
