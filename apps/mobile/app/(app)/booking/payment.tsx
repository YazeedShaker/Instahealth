import {
  PAYMENT_METHOD_OPTIONS,
  createMockPaymentProvider,
  formatPayCtaLabelAr,
  getRemainingHoldSeconds,
  type PaymentMethod,
} from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { Redirect, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { Pressable, ScrollView, Switch, Text, View } from 'react-native'

import { FlowCtaBar } from '../../../components/booking/FlowCtaBar'
import { OrderSummaryCard } from '../../../components/booking/OrderSummaryCard'
import { PaymentMethodRow } from '../../../components/booking/PaymentMethodRow'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { useConfirmationStore } from '../../../features/booking/confirmationStore'
import { handleHoldExpired } from '../../../features/booking/expiry'
import { settlePayment } from '../../../features/booking/settle'
import { useBookingStore } from '../../../features/booking/store'

// Step 4 — payment (F06), built to the approved step-4 design incl. its
// payment-failed state. Replaces the F05 stub.
//
// THE ARCHITECTURE, in one paragraph: this screen asks a PaymentProvider to
// take the money and then posts the OUTCOME to `settle-payment`. It never
// calls confirm_booking (no grant) and never writes a payments row (no RLS
// policy) — those are structurally out of reach. Swapping the mock for PayTabs
// changes the provider, not this screen.

const FAILURE_MESSAGE_AR =
  'لم نتمكن من إتمام الدفع. حاول مرة أخرى أو اختر الدفع نقداً عند الوصول — حجزك ما زال محفوظاً لك.'
const GENERIC_ERROR_AR = 'تعذّر إتمام العملية — تحقق من الاتصال وحاول مرة أخرى.'

export default function PaymentScreen() {
  const router = useRouter()
  const branchNameAr = useBookingStore((state) => state.branchNameAr)
  const selectedServices = useBookingStore((state) => state.selectedServices)
  const hold = useBookingStore((state) => state.hold)
  const pendingBooking = useBookingStore((state) => state.pendingBooking)
  const confirmedHandoff = useBookingStore((state) => state.confirmedHandoff)
  const setConfirmation = useConfirmationStore((state) => state.setConfirmation)

  const [method, setMethod] = useState<PaymentMethod>('card')
  const [isPaying, setIsPaying] = useState(false)
  const [failedMethod, setFailedMethod] = useState<PaymentMethod | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [simulateFailure, setSimulateFailure] = useState(false)
  // Each retry gets its own provider reference, exactly as a real gateway
  // would issue a new transaction per attempt.
  const attemptRef = useRef(1)

  // No live hold or no pending booking → nothing to pay for. Same guard the
  // F05 stub had (deep entry, expiry modal, session restore) — EXCEPT during
  // the confirmation hand-off, where the store is empty precisely BECAUSE the
  // booking succeeded and this screen is one commit from unmounting.
  if (hold === null || pendingBooking === null) {
    if (confirmedHandoff) return null
    return <Redirect href="/(app)/booking/slot" />
  }

  // The SERVER's total, derived from branch_services when the pending booking
  // was created — not a client-side sum. If a price moved while the patient
  // was choosing, this is what they are actually charged, so it is what they
  // must see before paying.
  const totalEgp = pendingBooking.totalEgp
  const isHospital = selectedServices.some((service) => service.categorySlug === 'scans')

  const handlePay = async () => {
    if (isPaying) return
    setIsPaying(true)
    setErrorMessage(null)

    try {
      // DISPLAY PREDICATE = ENFORCEMENT PREDICATE: re-check the hold against
      // the SERVER's expiry before spending the patient's time on a payment
      // the settlement step would refuse anyway.
      if (getRemainingHoldSeconds(new Date(hold.expiresAt), new Date()) <= 0) {
        handleHoldExpired()
        return
      }

      const provider = createMockPaymentProvider({ simulateFailure })
      const initiation = await provider.initiatePayment({
        bookingId: pendingBooking.id,
        bookingRef: pendingBooking.bookingRef,
        amountEgp: totalEgp,
        method,
        attempt: attemptRef.current,
      })
      attemptRef.current += 1

      // The mock is always inline. A redirect result (PayTabs hosted page)
      // would open the URL and let the IPN settle — not reachable yet, so it
      // is an explicit error rather than a silent no-op.
      if (initiation.kind !== 'inline') {
        setErrorMessage(GENERIC_ERROR_AR)
        return
      }

      const outcome = await settlePayment({
        bookingId: pendingBooking.id,
        method,
        providerRef: initiation.providerRef,
        outcome: initiation.outcome,
        providerPayload: provider.isSimulated ? { simulated: true, provider: provider.id } : null,
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

      // Declined: the hold and the booking both survive, so the patient can
      // retry or switch to cash — the design's failure state, not a dead end.
      setFailedMethod(method)
      setErrorMessage(outcome.kind === 'paymentFailed' ? FAILURE_MESSAGE_AR : GENERIC_ERROR_AR)
    } finally {
      setIsPaying(false)
    }
  }

  const handleSelectMethod = (next: PaymentMethod) => {
    setMethod(next)
    // Switching away clears the failure decoration on the old row; the alert
    // stays until the next attempt resolves.
    if (failedMethod !== null && next !== failedMethod) setFailedMethod(null)
  }

  const hasFailed = errorMessage !== null

  return (
    <View className="flex-1 bg-ih-neutral-50">
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text className="font-arabic-bold text-xl text-ih-neutral-800">مراجعة الطلب والدفع</Text>

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

        <View className="gap-2.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="font-arabic-bold text-sm text-ih-neutral-700">طريقة الدفع</Text>
            {/* Honesty over polish: no real money moves yet, and the patient
                must never think it did (PRODUCT.md §1 — trust before delight). */}
            <Text
              testID="payment-test-mode-badge"
              className="rounded-ih-full px-2.5 py-0.5 font-arabic-bold text-[11px]"
              style={{
                backgroundColor: colors.semantic.warningBg,
                color: colors.semantic.warningText,
              }}
            >
              وضع تجريبي
            </Text>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel="طريقة الدفع" className="gap-2.5">
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <PaymentMethodRow
                key={option.method}
                option={option}
                selected={method === option.method}
                failed={failedMethod === option.method}
                disabled={isPaying}
                onSelect={() => handleSelectMethod(option.method)}
              />
            ))}
          </View>
        </View>

        {__DEV__ ? (
          <Pressable
            testID="payment-simulate-failure"
            accessibilityRole="switch"
            accessibilityLabel="محاكاة فشل الدفع (وضع التطوير)"
            accessibilityState={{ checked: simulateFailure }}
            onPress={() => setSimulateFailure((on) => !on)}
            className="flex-row items-center justify-between gap-3 rounded-ih-sm border border-dashed border-ih-neutral-300 bg-ih-neutral-0 px-4 py-3"
          >
            <Text className="flex-1 font-arabic text-xs text-ih-neutral-500">
              DEV · محاكاة فشل الدفع (لا يظهر في الإصدار النهائي)
            </Text>
            <Switch
              value={simulateFailure}
              onValueChange={setSimulateFailure}
              trackColor={{ false: colors.neutral[300], true: colors.semantic.error }}
            />
          </Pressable>
        ) : null}
      </ScrollView>

      <FlowCtaBar>
        <PrimaryButton
          testID="payment-pay"
          label={hasFailed ? 'حاول مرة أخرى' : formatPayCtaLabelAr(method, totalEgp)}
          loading={isPaying}
          onPress={() => void handlePay()}
        />
        <Text
          testID="payment-footnote"
          className="text-center font-arabic text-xs text-ih-neutral-500"
        >
          {hasFailed
            ? 'موعدك ما زال محجوزاً — لن تفقد مكانك'
            : 'الدفع عبر PayTabs (قريباً) · يمكنك الإلغاء مجاناً قبل الموعد بـ ٤ ساعات'}
        </Text>
      </FlowCtaBar>
    </View>
  )
}
