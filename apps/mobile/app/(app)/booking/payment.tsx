import {
  V1_PAYMENT_METHOD,
  createMockPaymentProvider,
  formatPayCtaLabelAr,
  getRemainingHoldSeconds,
} from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { Redirect, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { FlowCtaBar } from '../../../components/booking/FlowCtaBar'
import { OrderSummaryCard } from '../../../components/booking/OrderSummaryCard'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { useConfirmationStore } from '../../../features/booking/confirmationStore'
import { handleHoldExpired } from '../../../features/booking/expiry'
import { settlePayment } from '../../../features/booking/settle'
import { useBookingStore } from '../../../features/booking/store'
//
// Step 4 — confirm (F06), COLLAPSED TO CASH for v1 (partner-trust decision,
// 2026-08-04): the app collects no money, so there is no method to choose and
// nothing is simulated. The patient confirms a booking and pays the branch.
//
// THE ARCHITECTURE IS UNCHANGED, deliberately: this screen still asks a
// PaymentProvider to "take" the money and posts the OUTCOME to
// `settle-payment`. It never calls confirm_booking (no grant) and never writes
// a payments row (no RLS policy). When card returns, the method lineup comes
// back in core and a chooser returns HERE — the settlement path never moves.
//
// ⚠ NO «وضع تجريبي» BADGE. It existed because prepaid methods were simulated
// and the patient must never think money moved. Cash is REAL: the amount is a
// quote, collected at the desk. Badging it would invent a doubt.

const GENERIC_ERROR_AR = 'تعذّر تأكيد الحجز — تحقق من الاتصال وحاول مرة أخرى.'

export default function PaymentScreen() {
  const router = useRouter()
  const branchNameAr = useBookingStore((state) => state.branchNameAr)
  const selectedServices = useBookingStore((state) => state.selectedServices)
  const hold = useBookingStore((state) => state.hold)
  const pendingBooking = useBookingStore((state) => state.pendingBooking)
  const confirmedHandoff = useBookingStore((state) => state.confirmedHandoff)
  const setConfirmation = useConfirmationStore((state) => state.setConfirmation)

  const [isPaying, setIsPaying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Each retry gets its own provider reference, exactly as a real gateway
  // would issue a new transaction per attempt.
  const attemptRef = useRef(1)

  // No live hold or no pending booking → nothing to confirm. Same guard the
  // F05 stub had (deep entry, expiry modal, session restore) — EXCEPT during
  // the confirmation hand-off, where the store is empty precisely BECAUSE the
  // booking succeeded and this screen is one commit from unmounting.
  if (hold === null || pendingBooking === null) {
    if (confirmedHandoff) return null
    return <Redirect href="/(app)/booking/slot" />
  }

  // The SERVER's total, derived from branch_services when the pending booking
  // was created — not a client-side sum. If a price moved while the patient
  // was choosing, this is what the branch will collect, so it is what they
  // must see before confirming.
  const totalEgp = pendingBooking.totalEgp
  const isHospital = selectedServices.some((service) => service.categorySlug === 'scans')

  const handleConfirm = async () => {
    if (isPaying) return
    setIsPaying(true)
    setErrorMessage(null)

    try {
      // DISPLAY PREDICATE = ENFORCEMENT PREDICATE: re-check the hold against
      // the SERVER's expiry before spending the patient's time on a booking
      // the settlement step would refuse anyway.
      if (getRemainingHoldSeconds(new Date(hold.expiresAt), new Date()) <= 0) {
        handleHoldExpired()
        return
      }

      const provider = createMockPaymentProvider()
      const initiation = await provider.initiatePayment({
        bookingId: pendingBooking.id,
        bookingRef: pendingBooking.bookingRef,
        amountEgp: totalEgp,
        method: V1_PAYMENT_METHOD,
        attempt: attemptRef.current,
      })
      attemptRef.current += 1

      // Cash is always inline — there is no gateway to redirect to. A redirect
      // result would mean a prepaid provider was wired in without this screen
      // being updated, so it is an explicit error rather than a silent no-op.
      if (initiation.kind !== 'inline') {
        setErrorMessage(GENERIC_ERROR_AR)
        return
      }

      const outcome = await settlePayment({
        bookingId: pendingBooking.id,
        method: V1_PAYMENT_METHOD,
        providerRef: initiation.providerRef,
        outcome: initiation.outcome,
        // No payload: nothing is simulated for cash, so there is no simulation
        // to record. The prepaid path re-attaches it with the provider.
        providerPayload: null,
      })

      if (outcome.kind === 'confirmed') {
        setConfirmation(outcome.confirmation)
        // ⚠ THE LANDMINE (PROGRESS, F05 hand-off): clear the flow state BEFORE
        // navigating out of /booking. The segments watcher in (app)/_layout
        // fires the moment the route leaves the flow and, if it still sees a
        // hold or pending booking, cancels the booking we just confirmed.
        // Zustand updates synchronously, so by the time the route changes
        // there is nothing left for it to clean up.
        //
        // `completeBooking` (not `reset`) also raises `confirmedHandoff`, which
        // stands the flow guards down for this one commit — clearing the store
        // otherwise makes this screen redirect to /slot and the flow layout
        // redirect to /home while the replace below is still in flight, and the
        // navigator loses: the NEXT booking opens blank and unclickable.
        useBookingStore.getState().completeBooking()
        router.replace('/(app)/confirmation')
        return
      }

      if (outcome.kind === 'holdExpired') {
        handleHoldExpired()
        return
      }

      // `paymentFailed` is UNREACHABLE for cash — there is no gateway to
      // decline — so every remaining outcome is a connection or server
      // problem the patient resolves by retrying. The hold and the booking
      // both survive, so retry is safe.
      setErrorMessage(GENERIC_ERROR_AR)
    } finally {
      setIsPaying(false)
    }
  }

  const hasFailed = errorMessage !== null

  return (
    <View className="flex-1 bg-ih-neutral-50">
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text className="font-arabic-bold text-xl text-ih-neutral-800">مراجعة الطلب والتأكيد</Text>

        {hasFailed ? (
          <View
            testID="payment-error"
            accessibilityRole="alert"
            className="flex-row gap-2.5 rounded-ih-md px-4 py-3.5"
            style={{
              backgroundColor: colors.semantic.errorBg,
              borderWidth: 1,
              borderColor: colors.semantic.error,
            }}
          >
            <Text className="text-[15px]">⚠</Text>
            <Text
              className="flex-1 font-arabic text-[13.5px] leading-6"
              style={{ color: colors.semantic.errorText }}
            >
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <OrderSummaryCard
          branchNameAr={branchNameAr ?? ''}
          isHospital={isHospital}
          services={selectedServices}
          slotDate={hold.slotDate}
          slotTime={hold.slotTime}
          totalEgp={totalEgp}
        />

        {/* The method is a STATEMENT, not a choice — one method, so a
            radiogroup would be a control with nothing to control. */}
        <View className="gap-2.5">
          <Text className="font-arabic-bold text-sm text-ih-neutral-700">طريقة الدفع</Text>
          <View
            testID="payment-cash-notice"
            className="flex-row items-center gap-3 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0 px-4 py-3.5"
          >
            <Text className="text-xl">💵</Text>
            <View className="flex-1 gap-0.5">
              <Text className="font-arabic-bold text-[15px] text-ih-neutral-800">
                الدفع نقداً عند الوصول
              </Text>
              <Text className="font-arabic text-[13px] leading-5 text-ih-neutral-600">
                تدفع في المركز مباشرة بعد الخدمة — لا نطلب أي دفع داخل التطبيق.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <FlowCtaBar>
        <PrimaryButton
          testID="payment-pay"
          label={hasFailed ? 'حاول مرة أخرى' : formatPayCtaLabelAr(V1_PAYMENT_METHOD, totalEgp)}
          loading={isPaying}
          onPress={() => void handleConfirm()}
        />
        <Text
          testID="payment-footnote"
          className="text-center font-arabic text-xs text-ih-neutral-500"
        >
          {hasFailed
            ? 'موعدك ما زال محجوزاً — لن تفقد مكانك'
            : 'يمكنك الإلغاء مجاناً قبل الموعد بـ ٤ ساعات'}
        </Text>
      </FlowCtaBar>
    </View>
  )
}
