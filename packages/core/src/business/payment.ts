// Payment domain: the method lineup, the provider abstraction, and the
// settlement contract shared by the mobile app, the `settle-payment` Edge
// Function, and (later) the provider dashboard.
//
// ARCHITECTURE (SPEC-F06): the client NEVER calls `confirm_booking()` and never
// writes a payments row. It asks a PaymentProvider to take the money, then
// hands the provider's outcome to `settle-payment`, which is the ONE place
// `confirm_booking()` is reachable from. Swapping the mock for PayTabs changes
// the provider module only — the settlement path is identical.

import { parseFastingHours } from './preparation'
import { formatEgpDigitsAr } from './selection'
import type { SelectedService } from '../types/domain.types'

// ── Methods ────────────────────────────────────────────────────────────────

/** Every method the DB accepts — mirrors the `bookings_payment_method_check`
 * constraint. Adding one here without a migration will fail at INSERT time. */
export const PAYMENT_METHODS = ['card', 'fawry', 'vodafone_cash', 'orange_cash', 'cash'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/**
 * The lineup the approved step-4 design renders, in order.
 *
 * ⚠ PayTabs Egypt's real lineup DIFFERS from this list: it has no Fawry and no
 * Vodafone Cash. Its Egyptian methods are `creditcard`, `aman`, `meezaqr` and
 * `valu`. The final method lineup is an OPEN PRODUCT DECISION — we ship the
 * approved design's rows now (they map cleanly onto DB values) and revisit when
 * the PayTabs merchant profile exists. See `payment-paytabs.ts`.
 */
export const OFFERED_PAYMENT_METHODS = [
  'card',
  'fawry',
  'cash',
] as const satisfies readonly PaymentMethod[]

export interface PaymentMethodOption {
  method: PaymentMethod
  icon: string
  labelAr: string
  hintAr: string
}

/** Row copy straight from the approved design (`٤ · الدفع`). */
export const PAYMENT_METHOD_OPTIONS: readonly PaymentMethodOption[] = [
  { method: 'card', icon: '💳', labelAr: 'بطاقة', hintAr: 'فيزا أو ماستركارد — عبر PayTabs' },
  { method: 'fawry', icon: '🧾', labelAr: 'فوري', hintAr: 'ادفع بكود فوري من أقرب منفذ' },
  {
    method: 'cash',
    icon: '💵',
    labelAr: 'الدفع نقداً عند الوصول',
    hintAr: 'ادفع في المعمل مباشرة',
  },
]

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value)
}

/** Cash is settled at the branch — everything else is charged up front.
 * This is the SAME predicate `confirm_booking()` branches on. */
export function isPrepaidMethod(method: PaymentMethod): boolean {
  return method !== 'cash'
}

/** What `confirm_booking()` will write, computed client-side ONLY for display
 * (the DB remains authoritative). Mirrors the function's two CASE expressions. */
export function getPaymentStatusForMethod(method: PaymentMethod): {
  bookingPaymentStatus: 'paid' | 'cash'
  paymentRowStatus: 'completed' | 'pending'
} {
  return isPrepaidMethod(method)
    ? { bookingPaymentStatus: 'paid', paymentRowStatus: 'completed' }
    : { bookingPaymentStatus: 'cash', paymentRowStatus: 'pending' }
}

/** The confirmation screen's sub-label under "الإجمالي المدفوع" — e.g.
 * "بطاقة · تم الدفع" (design) or the honest cash variant. */
export function formatPaymentMethodStatusAr(method: PaymentMethod): string {
  const option = PAYMENT_METHOD_OPTIONS.find((candidate) => candidate.method === method)
  const label = option?.labelAr ?? method
  return isPrepaidMethod(method) ? `${label} · تم الدفع` : 'نقداً · الدفع عند الوصول'
}

/** The step-4 CTA. Cash isn't a payment, so it doesn't say "ادفع". */
export function formatPayCtaLabelAr(method: PaymentMethod, totalEgp: number): string {
  return isPrepaidMethod(method) ? `ادفع ${formatEgpDigitsAr(totalEgp)} EGP` : 'تأكيد الحجز'
}

// ── Provider abstraction ───────────────────────────────────────────────────

export type PaymentOutcome = 'success' | 'failure'

export interface PaymentIntent {
  bookingId: string
  bookingRef: string | null
  amountEgp: number
  method: PaymentMethod
  /** 1-based; a retry after a failure is attempt 2. Keeps provider refs unique. */
  attempt: number
}

/** An inline result — the money moved (or didn't) without leaving the app.
 * The mock always returns this; PayTabs card payments will return `redirect`. */
export interface InlinePaymentResult {
  kind: 'inline'
  providerRef: string
  outcome: PaymentOutcome
  /** Machine-readable, never shown raw to the patient. */
  failureReason: string | null
}

/** A hosted-page result — the patient finishes on the provider's page and the
 * provider's server-to-server callback settles the booking. */
export interface RedirectPaymentResult {
  kind: 'redirect'
  providerRef: string
  redirectUrl: string
}

export type PaymentInitiation = InlinePaymentResult | RedirectPaymentResult

export interface PaymentProvider {
  readonly id: string
  /** True when no real money moves — the UI MUST surface a test-mode badge. */
  readonly isSimulated: boolean
  supportsMethod(method: PaymentMethod): boolean
  initiatePayment(intent: PaymentIntent): Promise<PaymentInitiation>
}

export interface MockPaymentProviderOptions {
  /** DEV-only toggle that drives the design's payment-failure state. */
  simulateFailure?: boolean
  /** Injected so tests get deterministic refs; defaults to the intent's own ids. */
  generateReference?: (intent: PaymentIntent) => string
}

export const MOCK_PAYMENT_PROVIDER_ID = 'mock'
export const MOCK_FAILURE_REASON = 'simulated_failure'

function defaultMockReference(intent: PaymentIntent): string {
  return `MOCK-${intent.bookingId.slice(0, 8).toUpperCase()}-${intent.attempt}`
}

/**
 * The provider that ships until PayTabs credentials exist. It moves no money
 * but exercises the EXACT machinery PayTabs will: it produces a provider
 * reference and an outcome, and settlement happens server-side from there.
 *
 * Cash never "fails" — there is no gateway to fail — so the failure toggle
 * only affects prepaid methods.
 */
export function createMockPaymentProvider(
  options: MockPaymentProviderOptions = {},
): PaymentProvider {
  const generateReference = options.generateReference ?? defaultMockReference
  return {
    id: MOCK_PAYMENT_PROVIDER_ID,
    isSimulated: true,
    supportsMethod: (method) =>
      (OFFERED_PAYMENT_METHODS as readonly PaymentMethod[]).includes(method),
    initiatePayment: (intent) => {
      const shouldFail = options.simulateFailure === true && isPrepaidMethod(intent.method)
      return Promise.resolve({
        kind: 'inline',
        providerRef: generateReference(intent),
        outcome: shouldFail ? 'failure' : 'success',
        failureReason: shouldFail ? MOCK_FAILURE_REASON : null,
      })
    },
  }
}

// ── Settlement contract ────────────────────────────────────────────────────

/** What the client sends to `settle-payment`. For PayTabs this same shape is
 * built by the IPN handler from the verified callback instead. */
export interface PaymentSettlementRequest {
  bookingId: string
  method: PaymentMethod
  providerRef: string
  outcome: PaymentOutcome
  providerPayload: Record<string, unknown> | null
}

/** Errors `settle-payment` returns. Every one maps to Arabic copy in the app —
 * no raw error strings ever reach the patient. */
export const SETTLEMENT_ERRORS = [
  'invalid_request',
  'booking_not_found',
  'not_your_booking',
  'booking_not_payable',
  'hold_expired',
  'slot_unavailable',
  'payment_failed',
  'server_error',
] as const
export type SettlementError = (typeof SETTLEMENT_ERRORS)[number]

export interface ConfirmedBookingService {
  id: string
  nameAr: string
  nameEn: string
  priceEgp: number
  preparationNotesAr: string | null
  preparationNotesEn: string | null
}

/** Everything the confirmation screen renders. Built SERVER-side and returned
 * by `settle-payment` — the patient's own `slots` SELECT policy hides a slot
 * once it is fully booked, so the client cannot re-read its own slot after
 * confirming. Reading this DTO instead of re-querying is deliberate. */
export interface BookingConfirmation {
  bookingId: string
  bookingRef: string | null
  branchNameAr: string
  branchAddressAr: string | null
  isHospital: boolean
  slotDate: string
  slotTime: string
  services: ConfirmedBookingService[]
  totalEgp: number
  method: PaymentMethod
  confirmedAt: string
}

export type SettlementSmsStatus = 'sent' | 'failed' | 'skipped'

export type SettlementResult =
  | {
      success: true
      /** True when the booking was ALREADY confirmed — a retried settle.
       * PayTabs webhooks retry, so this is a normal outcome, not an error. */
      alreadyConfirmed: boolean
      confirmation: BookingConfirmation
      sms: SettlementSmsStatus
    }
  | { success: false; error: SettlementError }

/** Rehydrates the confirmation's services into the shape core's preparation
 * logic expects, parsing fasting hours ONCE (same rule as the branch profile).
 * The confirmation screen must show the SAME notes the selection screen did. */
export function toSelectedServices(services: ConfirmedBookingService[]): SelectedService[] {
  return services.map((service) => ({
    id: service.id,
    nameAr: service.nameAr,
    nameEn: service.nameEn,
    priceEgp: service.priceEgp,
    preparationNotesAr: service.preparationNotesAr,
    preparationNotesEn: service.preparationNotesEn,
    fastingHours: parseFastingHours(service.preparationNotesAr, service.preparationNotesEn),
  }))
}
