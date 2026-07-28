import { partitionBookings, type BookingTab } from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BookingCard } from '../../../components/bookings/BookingCard'
import { NoBookingsInTab, NoBookingsYet } from '../../../components/bookings/BookingsEmptyState'
import { useMyBookings } from '../../../features/bookings/queries'

// F07 — حجوزاتي, built to the approved My Bookings design: title, two tabs,
// booking cards. Tab bar stays VISIBLE here (DECISION-navigation-safe-areas §1
// lists My Bookings as a destination).

const TABS: { key: BookingTab; label: string }[] = [
  { key: 'upcoming', label: 'القادمة' },
  { key: 'past', label: 'السابقة' },
]

export default function BookingsScreen() {
  const router = useRouter()
  const bookingsQuery = useMyBookings()
  const [tab, setTab] = useState<BookingTab>('upcoming')

  // A booking's status changes on the PROVIDER's side (confirm, complete,
  // no-show) and this screen stays MOUNTED under Tabs, so `refetchOnMount`
  // alone would leave a stale status sitting there for as long as the app is
  // open. Refetch on every focus.
  const { refetch } = bookingsQuery
  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  // `now` is captured per render so a booking crossing its slot time moves
  // tabs on the next refetch rather than needing a timer.
  const grouped = useMemo(
    () => partitionBookings(bookingsQuery.data ?? [], new Date()),
    [bookingsQuery.data],
  )
  const hasAnyBooking = (bookingsQuery.data ?? []).length > 0
  const visible = grouped[tab]

  const header = (
    <View className="gap-3.5 border-b border-ih-neutral-200 bg-ih-neutral-0 px-5 pb-0 pt-3">
      <Text accessibilityRole="header" className="font-arabic-bold text-[22px] text-ih-neutral-800">
        حجوزاتي
      </Text>
      <View accessibilityRole="tablist" className="flex-row gap-1">
        {TABS.map((entry) => {
          const isActive = entry.key === tab
          return (
            <Pressable
              key={entry.key}
              testID={`bookings-tab-${entry.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={entry.label}
              onPress={() => setTab(entry.key)}
              className="min-h-[44px] flex-1 items-center justify-center pb-3 pt-2.5"
              style={{
                borderBottomWidth: 2.5,
                borderBottomColor: isActive ? colors.primary[400] : 'transparent',
              }}
            >
              <Text
                className={
                  isActive
                    ? 'font-arabic-bold text-[15px] text-ih-primary-600'
                    : 'font-arabic-semibold text-[15px] text-ih-neutral-500'
                }
              >
                {entry.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )

  if (bookingsQuery.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-ih-neutral-50" edges={['top']}>
        {header}
        <View className="gap-3 p-5">
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              className="h-[120px] rounded-ih-md bg-ih-neutral-200"
              style={{ opacity: 0.75 - index * 0.18 }}
            />
          ))}
        </View>
      </SafeAreaView>
    )
  }

  if (bookingsQuery.isError) {
    return (
      <SafeAreaView className="flex-1 bg-ih-neutral-50" edges={['top']}>
        {header}
        <View className="m-5 gap-3 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0 p-4">
          <Text className="font-arabic text-sm text-ih-neutral-700">
            تعذر تحميل حجوزاتك — تحقق من الاتصال وحاول مرة أخرى.
          </Text>
          <Pressable
            testID="bookings-retry"
            accessibilityRole="button"
            onPress={() => void bookingsQuery.refetch()}
            className="h-10 items-center justify-center rounded-ih-sm border border-ih-neutral-200"
          >
            <Text className="font-arabic-semibold text-sm text-ih-neutral-700">إعادة المحاولة</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  // A patient with NOTHING gets the first-run moment instead of an empty tab.
  if (!hasAnyBooking) {
    return (
      <SafeAreaView className="flex-1 bg-ih-neutral-50" edges={['top']}>
        {header}
        <NoBookingsYet onBookNow={() => router.push('/(app)/home')} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-50" edges={['top']}>
      {header}
      <FlatList
        testID="bookings-list"
        data={visible}
        keyExtractor={(booking) => booking.id}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        ListEmptyComponent={<NoBookingsInTab tab={tab} />}
        refreshControl={
          <RefreshControl
            refreshing={bookingsQuery.isRefetching}
            onRefresh={() => void bookingsQuery.refetch()}
            tintColor={colors.primary[400]}
          />
        }
        renderItem={({ item }) => (
          <BookingCard booking={item} onPress={() => router.push(`/(app)/bookings/${item.id}`)} />
        )}
      />
    </SafeAreaView>
  )
}
