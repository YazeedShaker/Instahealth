import { isSearchableQuery } from '@instahealth/core'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ProviderCard } from '../../components/home/ProviderCard'
import { SearchEmptyState } from '../../components/search/SearchEmptyState'
import { ServiceResultRow } from '../../components/search/ServiceResultRow'
import { useFirstAvailableSlots, useHomeBranches } from '../../features/home/queries'
import { sortBranchesForDisplay } from '../../features/home/sort'
import { useUserLocation } from '../../features/home/useUserLocation'
import { useActiveCategories, useSearchCatalog } from '../../features/search/queries'
import { useRecentSearches } from '../../features/search/recents'

const DEBOUNCE_MS = 300

// F03 — global search (SPEC-F03, Search.dc.html). Four states: initial
// (category chips + recent searches), live results (خدمات + مراكز), no
// results, skeletons. Search is a DESTINATION: tab bar stays visible
// (DECISION-navigation-safe-areas).
export default function Search() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [categorySlug, setCategorySlug] = useState<string | null>(null)
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null)

  // Debounce typing → query (~300ms per spec); category taps apply instantly.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [input])

  const { recents, add: addRecent, remove: removeRecent, clear: clearRecents } = useRecentSearches()
  const categoriesQuery = useActiveCategories()
  const { location } = useUserLocation()

  const searchActive = isSearchableQuery(query) || categorySlug !== null
  const resultsQuery = useSearchCatalog(query, categorySlug)
  const results = resultsQuery.data ?? null

  // «مراكز» renders the EXACT Home card over the exact Home data — the RPC
  // only decides WHICH branches matched.
  const homeBranchesQuery = useHomeBranches()
  const matchedBranches = useMemo(() => {
    if (results === null || homeBranchesQuery.data === undefined) return []
    const matched = new Set(results.branchIds)
    return sortBranchesForDisplay(
      homeBranchesQuery.data.filter((branch) => matched.has(branch.id)),
      location.coords,
    )
  }, [results, homeBranchesQuery.data, location.coords])
  const providerSlots = useFirstAvailableSlots(matchedBranches.map((branch) => branch.id))

  const now = new Date()
  const categories = categoriesQuery.data ?? []
  const hasAnyResults =
    results !== null && (results.services.length > 0 || matchedBranches.length > 0)

  const runSearch = (raw: string) => {
    setInput(raw)
    setQuery(raw)
    setExpandedServiceId(null)
    if (raw.trim().length > 0) addRecent(raw)
  }

  const clearSearch = () => {
    setInput('')
    setQuery('')
    setCategorySlug(null)
    setExpandedServiceId(null)
  }

  const pickCategory = (slug: string) => {
    setCategorySlug((current) => (current === slug ? null : slug))
    setExpandedServiceId(null)
  }

  const openBranchWithService = (branchId: string, branchServiceId: string) => {
    router.push(`/(app)/branch/${branchId}?preselect=${branchServiceId}`)
  }

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-50" edges={['top']}>
      {/* header + field, per the design */}
      <View className="gap-3 border-b border-ih-neutral-200 bg-ih-neutral-0 px-5 pb-3.5 pt-2">
        <Text className="font-arabic-bold text-[22px] text-ih-neutral-800">البحث</Text>
        <View
          className="min-h-[52px] flex-row items-center gap-2.5 rounded-ih-md border-[1.5px] border-ih-primary-400 bg-ih-neutral-0 px-3.5"
          style={{ shadowColor: '#02C39A', shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 }}
        >
          <Text className="text-[17px] opacity-70">🔍</Text>
          <TextInput
            testID="search-input"
            className="flex-1 py-3 font-arabic text-[15px] text-ih-neutral-800"
            placeholder="ابحث عن تحليل، أشعة، أو طبيب…"
            placeholderTextColor="#64748B"
            value={input}
            onChangeText={(text) => {
              setInput(text)
              setExpandedServiceId(null)
            }}
            onSubmitEditing={() => runSearch(input)}
            returnKeyType="search"
            autoCorrect={false}
          />
          {input.length > 0 || categorySlug !== null ? (
            <Pressable
              testID="search-clear"
              accessibilityRole="button"
              accessibilityLabel="مسح البحث"
              onPress={clearSearch}
              className="h-[22px] w-[22px] items-center justify-center rounded-ih-full bg-ih-neutral-100"
            >
              <Text className="text-[11px] text-ih-neutral-500">✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-5"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {!searchActive ? (
          /* ── initial state: category chips + recents ─────────────────── */
          <View className="gap-5 px-5 pt-4">
            <View className="gap-2.5">
              <Text className="font-arabic-bold text-[13px] text-ih-neutral-500">ابحث بالفئة</Text>
              <View className="flex-row flex-wrap gap-2">
                {categories.map((category) => (
                  <Pressable
                    key={category.slug}
                    testID={`search-category-${category.slug}`}
                    accessibilityRole="button"
                    accessibilityLabel={category.nameAr}
                    onPress={() => pickCategory(category.slug)}
                    className="min-h-[44px] flex-row items-center gap-1.5 rounded-ih-full border border-ih-primary-100 bg-ih-primary-50 px-3.5"
                  >
                    <Text className="text-[15px]">{category.icon}</Text>
                    <Text className="font-arabic-bold text-[13.5px] text-ih-primary-700">
                      {category.nameAr}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {recents !== null && recents.length > 0 ? (
              <View className="gap-1">
                <View className="flex-row items-center justify-between pb-1.5">
                  <Text className="font-arabic-bold text-[13px] text-ih-neutral-500">
                    أبحاثك السابقة
                  </Text>
                  <Pressable
                    testID="search-clear-recents"
                    accessibilityRole="button"
                    onPress={clearRecents}
                  >
                    <Text className="font-arabic-semibold text-[12.5px] text-ih-primary-600">
                      مسح الكل
                    </Text>
                  </Pressable>
                </View>
                {recents.map((recent) => (
                  <View
                    key={recent}
                    className="min-h-[48px] flex-row items-center gap-3 border-b border-ih-neutral-200 py-1"
                  >
                    <Text className="text-sm text-ih-neutral-400">🕐</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={recent}
                      onPress={() => runSearch(recent)}
                      className="min-h-[44px] flex-1 justify-center"
                    >
                      <Text className="font-arabic text-[14.5px] text-ih-neutral-800">
                        {recent}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`حذف ${recent}`}
                      onPress={() => removeRecent(recent)}
                      className="min-h-[44px] min-w-[44px] items-center justify-center"
                    >
                      <Text className="text-xs text-ih-neutral-400">✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : resultsQuery.isPending ? (
          /* ── skeletons ────────────────────────────────────────────────── */
          <View testID="search-skeleton" className="gap-3 px-5 pt-4">
            {[0, 1, 2, 3].map((index) => (
              <View
                key={index}
                className="h-16 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0 opacity-60"
              />
            ))}
          </View>
        ) : hasAnyResults ? (
          /* ── results: خدمات then مراكز ────────────────────────────────── */
          <View className="gap-[18px] px-5 pt-3.5">
            {results !== null && results.services.length > 0 ? (
              <View className="gap-2.5">
                <View className="flex-row items-baseline gap-2">
                  <Text className="font-arabic-bold text-[15px] text-ih-neutral-800">خدمات</Text>
                  <Text className="font-arabic text-xs text-ih-neutral-500">
                    {results.services.length} نتيجة
                  </Text>
                </View>
                <View className="overflow-hidden rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0">
                  {results.services.map((service) => (
                    <ServiceResultRow
                      key={service.serviceId}
                      service={service}
                      expanded={expandedServiceId === service.serviceId}
                      onToggle={() =>
                        setExpandedServiceId((current) =>
                          current === service.serviceId ? null : service.serviceId,
                        )
                      }
                      onPickBranch={openBranchWithService}
                      userCoords={location.coords}
                      now={now}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {matchedBranches.length > 0 ? (
              <View className="gap-3">
                <View className="flex-row items-baseline gap-2">
                  <Text className="font-arabic-bold text-[15px] text-ih-neutral-800">مراكز</Text>
                  <Text className="font-arabic text-xs text-ih-neutral-500">
                    {matchedBranches.length} نتيجة
                  </Text>
                </View>
                {matchedBranches.map((branch) => (
                  <ProviderCard
                    key={branch.id}
                    branch={branch}
                    firstSlot={providerSlots.data?.get(branch.id) ?? null}
                    now={now}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <SearchEmptyState
            categories={categories}
            onPickCategory={pickCategory}
            onPickSuggestion={runSearch}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
