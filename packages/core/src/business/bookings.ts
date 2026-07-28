// My Bookings (F07) — the domain rules behind the list, its two tabs, and the
// cancel affordance. Pure functions with `now` injected, per core discipline.

import { cairoWallClockToInstant } from './format'
import type { ConfirmedBookingService, PaymentMethod } from './payment'

/** Exactly the `bookings.status` CHECK constraint. `arrived` was added in
 * migration 20260728141703 (P01): the patient is at the desk but the service
 * has not been delivered yet. */
export const BOOKING_STATUSES = [
  'pending',
  'pending_payment',
  'confirmed',
  'arrived',
  'completed',
  'cancelled',
  'no_show',
] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

/** Exactly the `bookings.payment_status` CHECK constraint. */
export const BOOKING_PAYMENT_STATUSES = ['pending', 'paid', 'cash', 'refunded', 'failed'] as const
export type BookingPaymentStatus = (typeof BOOKING_PAYMENT_STATUSES)[number]

/**
 * One row of `get_patient_bookings()`, in domain shape.
 *
 * `slotDate`/`slotTime` come from that SECURITY DEFINER function and NOT from a
 * `bookings → slots` join: the `slots` SELECT policy is
 * `booked_count < capacity`, so a patient cannot read the slot of their own
 * fully-booked booking — precisely the bookings this screen exists to show.
 */
export interface PatientBooking {
  id: string
  bookingRef: string | null
  status: BookingStatus
  paymentStatus: BookingPaymentStatus
  method: PaymentMethod | null
  totalEgp: number
  patientNotes: string | null
  createdAt: string
  cancelledAt: string | null
  /** Egypt wall clock — pair with `cairoWallClockToInstant` for any comparison. */
  slotDate: string
  slotTime: string
  branchId: string
  branchNameAr: string
  branchAddressAr: string | null
  branchPhone: string | null
  branchLat: number | null
  branchLng: number | null
  isHospital: boolean
  services: ConfirmedBookingService[]
}

export type BookingTab = 'upcoming' | 'past'

/** Colour is never the only signal (PRODUCT.md §3) — a tone ALWAYS travels with
 * its Arabic label so a colourblind patient reads the same state. */
export type BookingStatusTone = 'success' | 'warning' | 'neutral' | 'error' | 'info'

export interface BookingStatusChip {
  labelAr: string
  tone: BookingStatusTone
}

const STATUS_CHIPS: Record<BookingStatus, BookingStatusChip> = {
  confirmed: { labelAr: 'مؤكد', tone: 'success' },
  pending: { labelAr: 'قيد التأكيد', tone: 'warning' },
  // The patient is at the desk. Only the provider dashboard writes this, but
  // the patient app must render it too — a patient checking حجوزاتي while
  // standing at reception should not see a blank chip.
  arrived: { labelAr: 'وصل', tone: 'info' },
  // Flow debris — `get_patient_bookings` filters it out, but the mapping is
  // exhaustive so a leaked row renders honestly instead of blank.
  pending_payment: { labelAr: 'بانتظار الدفع', tone: 'warning' },
  completed: { labelAr: 'مكتمل', tone: 'neutral' },
  cancelled: { labelAr: 'ملغي', tone: 'error' },
  no_show: { labelAr: 'لم يتم الحضور', tone: 'neutral' },
}

/**
 * The ONE source for a booking's status chip. Takes the whole booking, not just
 * the status, so payment state can qualify it: a confirmed booking that will be
 * paid in cash is still "مؤكد" — the cash-vs-paid distinction belongs on the
 * payment line (`getBookingPaymentLabelAr`), because collapsing it into the
 * status chip would make an unpaid-but-confirmed booking look unconfirmed.
 */
// Takes the STATUS-bearing shape rather than a whole PatientBooking so the
// provider dashboard's BranchBooking uses the identical chip without a cast —
// one source, two surfaces, no drift.
export function getBookingStatusChip(booking: { status: BookingStatus }): BookingStatusChip {
  return STATUS_CHIPS[booking.status]
}

/**
 * The F06 payment distinction, which MUST be visible everywhere a booking
 * renders: prepaid bookings say so, cash bookings tell the patient they still
 * owe money at the branch.
 */
export function getBookingPaymentLabelAr(booking: {
  paymentStatus: BookingPaymentStatus
  method: PaymentMethod | string | null
}): string {
  if (booking.paymentStatus === 'paid') return 'تم الدفع'
  if (booking.paymentStatus === 'refunded') return 'تم رد المبلغ'
  if (booking.method === 'cash' || booking.paymentStatus === 'cash') return 'الدفع عند الوصول'
  return 'لم يتم الدفع بعد'
}

/** Statuses that are still "live" — the appointment may yet happen. `arrived`
 * counts: the patient is there and the service is still to come. */
const LIVE_STATUSES: readonly BookingStatus[] = [
  'pending',
  'pending_payment',
  'confirmed',
  'arrived',
]

/** The moment the appointment starts, as a real instant. */
export function getBookingStartsAt(booking: PatientBooking): Date {
  return cairoWallClockToInstant(booking.slotDate, booking.slotTime)
}

/**
 * القادمة vs السابقة. A booking is upcoming only while it is BOTH still live
 * and yet to happen — so a cancelled appointment next week sits under
 * "السابقة" (matching the approved design, whose past list carries a cancelled
 * row), and a confirmed one whose time has passed moves there on its own.
 */
export function getBookingTab(booking: PatientBooking, now: Date): BookingTab {
  if (!LIVE_STATUSES.includes(booking.status)) return 'past'
  return getBookingStartsAt(booking).getTime() > now.getTime() ? 'upcoming' : 'past'
}

/**
 * Splits and orders both tabs. The orders differ on purpose and match the
 * design: upcoming reads SOONEST-FIRST (what do I need to prepare for?), past
 * reads MOST-RECENT-FIRST (what did I just do?).
 */
export function partitionBookings(
  bookings: readonly PatientBooking[],
  now: Date,
): Record<BookingTab, PatientBooking[]> {
  const upcoming: PatientBooking[] = []
  const past: PatientBooking[] = []
  for (const booking of bookings) {
    if (getBookingTab(booking, now) === 'upcoming') upcoming.push(booking)
    else past.push(booking)
  }
  const startsAt = (booking: PatientBooking) => getBookingStartsAt(booking).getTime()
  upcoming.sort((a, b) => startsAt(a) - startsAt(b))
  past.sort((a, b) => startsAt(b) - startsAt(a))
  return { upcoming, past }
}

/**
 * The RATIFIED cancellation rule (SPEC-F07, which supersedes the design
 * bundle): a patient may cancel ANY TIME BEFORE THE SLOT STARTS — free, no
 * fees, every payment method. There is deliberately no cutoff window and no
 * fee logic anywhere in the stack.
 *
 * This is the SAME predicate `cancel_booking()` enforces for a patient caller
 * (migration 20260728120808 + the slot-start boundary), so the button can never
 * offer something the server refuses, nor hide something it would allow.
 */
export function isCancellable(booking: PatientBooking, now: Date): boolean {
  if (!LIVE_STATUSES.includes(booking.status)) return false
  return getBookingStartsAt(booking).getTime() > now.getTime()
}

/** "صورة دم كاملة · سكر صائم" — the card's one-line service summary. */
export function summarizeBookingServicesAr(services: readonly ConfirmedBookingService[]): string {
  return services.map((service) => service.nameAr).join(' · ')
}
