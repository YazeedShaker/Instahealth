import { buildSlotDaySections, type SlotPickerSlot } from '@instahealth/core'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { DateStrip } from '../../../components/booking/DateStrip'
import { FlowCtaBar } from '../../../components/booking/FlowCtaBar'
import { MonthPicker } from '../../../components/booking/MonthPicker'
import { TimeGrid } from '../../../components/booking/TimeGrid'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { useAuthStore } from '../../../features/auth/store'
import { acquireSlotHold } from '../../../features/booking/api'
import { useBookingSlots } from '../../../features/booking/queries'
import { useBranchHoldsRealtime } from '../../../features/booking/realtime'
import { useBookingStore } from '../../../features/booking/store'

// Step 2 — slot picker (F05). Tapping an available slot takes the 10-minute
// hold via the create_slot_hold RPC (PRODUCT.md §7: selecting starts the
// hold). التالي only navigates once a hold actually exists — never
// optimistically.
export default function SlotPickerScreen() {
  const router = useRouter()
  const userId = useAuthStore((state) => state.session?.user.id ?? null)
  const branchId = useBookingStore((state) => state.branchId)
  const hold = useBookingStore((state) => state.hold)

  const slotsQuery = useBookingSlots(branchId)
  useBranchHoldsRealtime(branchId) // push: other patients' holds/releases appear live
  const now = new Date()
  const sections = useMemo(
    () => buildSlotDaySections(slotsQuery.data ?? [], now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slotsQuery.data],
  )

  const [pickedDate, setPickedDate] = useState<string | null>(null)
  const [isMonthOpen, setIsMonthOpen] = useState(false)
  const [requestingSlotId, setRequestingSlotId] = useState<string | null>(null)
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null)

  const defaultDate = sections.find((section) => section.hasAvailability)?.date ?? null
  const selectedDate = pickedDate ?? hold?.slotDate ?? defaultDate
  const selectedSection = sections.find((section) => section.date === selectedDate) ?? null

  const handleSelectDate = (date: string) => {
    setPickedDate(date)
    setIsMonthOpen(false)
  }

  const handleSelectSlot = async (slot: SlotPickerSlot) => {
    if (userId === null || requestingSlotId !== null) return
    if (hold?.slotId === slot.id) return // already held — nothing to do
    setRequestingSlotId(slot.id)
    setRejectionMessage(null)
    try {
      const { hold: newHold, failure } = await acquireSlotHold(
        { id: slot.id, slotDate: slot.slotDate, slotTime: slot.slotTime },
        userId,
      )
      const store = useBookingStore.getState()
      if (newHold !== null) {
        // A re-pick makes any earlier pending booking stale (patients cannot
        // UPDATE bookings) — review will cancel + recreate it.
        store.setHold(newHold)
        return
      }
      // Rejection: the server only releases our previous hold on SUCCESS, so
      // any earlier hold (and its timer) is still ours — keep it selected.
      setRejectionMessage(
        failure === 'slot_taken'
          ? 'تم حجز هذا الموعد للتو — اختر موعداً آخر'
          : 'تعذر حجز الموعد — تحقق من الاتصال وحاول مرة أخرى',
      )
      void slotsQuery.refetch()
    } finally {
      setRequestingSlotId(null)
    }
  }

  return (
    <View className="flex-1 bg-ih-neutral-50">
      <ScrollView contentContainerStyle={{ paddingVertical: 20, gap: 18 }}>
        <View className="flex-row items-center justify-between gap-2.5 px-5">
          <Text className="font-arabic-bold text-xl text-ih-neutral-800">اختر الموعد المناسب</Text>
          <Pressable
            testID="month-toggle"
            accessibilityRole="button"
            accessibilityLabel="عرض الشهر كاملاً"
            onPress={() => setIsMonthOpen((open) => !open)}
            className="min-h-[44px] flex-row items-center gap-1.5 rounded-ih-full border border-ih-neutral-200 bg-ih-neutral-0 px-3.5"
          >
            <Text className="text-base">📅</Text>
            <Text className="font-arabic-semibold text-xs text-ih-neutral-600">الشهر</Text>
          </Pressable>
        </View>

        {slotsQuery.isPending ? (
          <View className="flex-row gap-2 px-5" accessibilityLabel="جارٍ تحميل المواعيد…">
            {[0, 1, 2, 3, 4].map((index) => (
              <View
                key={index}
                className="h-[72px] w-[60px] rounded-ih-md bg-ih-neutral-200"
                style={{ opacity: 0.8 - index * 0.12 }}
              />
            ))}
          </View>
        ) : slotsQuery.isError ? (
          <View className="mx-5 gap-3 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0 p-4">
            <Text className="font-arabic text-sm text-ih-neutral-700">
              تعذر تحميل المواعيد — تحقق من الاتصال وحاول مرة أخرى.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void slotsQuery.refetch()}
              className="h-10 items-center justify-center rounded-ih-sm border border-ih-neutral-200"
            >
              <Text className="font-arabic-semibold text-sm text-ih-neutral-700">
                إعادة المحاولة
              </Text>
            </Pressable>
          </View>
        ) : sections.length === 0 ? (
          <View className="items-center gap-2 px-5 py-8">
            <Text className="text-3xl">🗓️</Text>
            <Text className="text-center font-arabic text-sm leading-6 text-ih-neutral-500">
              لا توجد مواعيد متاحة حالياً — حاول لاحقاً أو تواصل مع المركز مباشرة
            </Text>
          </View>
        ) : (
          <>
            <DateStrip
              sections={sections}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
            />
            {isMonthOpen ? (
              <MonthPicker
                sections={sections}
                selectedDate={selectedDate}
                now={now}
                onPickDate={handleSelectDate}
                onClose={() => setIsMonthOpen(false)}
              />
            ) : null}
            {rejectionMessage !== null ? (
              <View
                testID="slot-rejection"
                className="mx-5 rounded-ih-sm border border-ih-error/30 bg-ih-error/10 px-4 py-3"
              >
                <Text className="font-arabic-semibold text-[13px] text-ih-error">
                  {rejectionMessage}
                </Text>
              </View>
            ) : null}
            <TimeGrid
              section={selectedSection}
              selectedSlotId={hold?.slotId ?? null}
              requestingSlotId={requestingSlotId}
              onSelectSlot={(slot) => void handleSelectSlot(slot)}
            />
          </>
        )}
      </ScrollView>
      <FlowCtaBar>
        <PrimaryButton
          testID="slot-next"
          label="التالي"
          disabled={hold === null}
          loading={requestingSlotId !== null}
          onPress={() => router.push('/(app)/booking/review')}
        />
      </FlowCtaBar>
    </View>
  )
}
