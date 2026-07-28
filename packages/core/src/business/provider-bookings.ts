// P01 — the receptionist's view of a booking. Pure functions with `now`
// injected, shared so the dashboard and any future admin surface derive the
// same row state from the same rules.

import { getBookingPaymentLabelAr, type BookingStatus, type BookingStatusChip } from './bookings'
import type { ConfirmedBookingService } from './payment'

/** One row of `get_branch_bookings_for_date()`, in domain shape. That function
 * is SECURITY DEFINER because `users` has no provider SELECT policy — a
 * receptionist cannot read patient name/phone from a table query. */
export interface BranchBooking {
  id: string
  bookingRef: string | null
  status: BookingStatus
  paymentStatus: 'pending' | 'paid' | 'cash' | 'refunded' | 'failed'
  method: string | null
  totalEgp: number
  patientNotes: string | null
  slotId: string
  /** Egypt wall clock, "HH:MM:SS". */
  slotTime: string
  createdAt: string
  arrivedAt: string | null
  completedAt: string | null
  noShowAt: string | null
  cancelledAt: string | null
  patientNameAr: string | null
  patientPhone: string | null
  services: ConfirmedBookingService[]
}

/** The outcomes a receptionist can record. Mirrors `mark_booking_outcome`. */
export const BOOKING_OUTCOMES = ['arrived', 'completed', 'no_show'] as const
export type BookingOutcome = (typeof BOOKING_OUTCOMES)[number]

/**
 * The legal transition table, mirroring `mark_booking_outcome` exactly.
 * DISPLAY PREDICATE = ENFORCEMENT PREDICATE (ENGINEERING-WORKFLOW §1.4): the
 * button the desk sees must be one the server will accept. Change one, change
 * both, in the same PR.
 */
const LEGAL_TRANSITIONS: Record<BookingOutcome, readonly BookingStatus[]> = {
  arrived: ['confirmed', 'pending_payment'],
  completed: ['arrived'],
  no_show: ['confirmed', 'pending_payment', 'arrived'],
}

export function canMarkOutcome(booking: BranchBooking, outcome: BookingOutcome): boolean {
  return LEGAL_TRANSITIONS[outcome].includes(booking.status)
}

export interface OutcomeAction {
  outcome: BookingOutcome
  labelAr: string
}

/**
 * The ONE primary action per row, per the approved design:
 *   confirmed | pending_payment → [وصل]
 *   arrived                     → [تمت الخدمة]
 * Anything terminal has no primary action.
 */
export function getPrimaryOutcomeAction(booking: BranchBooking): OutcomeAction | null {
  if (canMarkOutcome(booking, 'arrived')) return { outcome: 'arrived', labelAr: 'وصل' }
  if (canMarkOutcome(booking, 'completed')) return { outcome: 'completed', labelAr: 'تمت الخدمة' }
  return null
}

/** Whether to offer [لم يحضر] alongside the primary action. */
export function canMarkNoShow(booking: BranchBooking): boolean {
  return canMarkOutcome(booking, 'no_show')
}

/**
 * Cash the desk still has to collect. This is the number that decides whether
 * the receptionist asks for money, so it keys off the SAME fields the DB uses:
 * `payment_status = 'cash'` is what confirm_booking writes for a cash booking,
 * and `mark_booking_outcome` flips it to 'paid' on completion.
 */
export function isAwaitingCashCollection(booking: BranchBooking): boolean {
  return booking.paymentStatus === 'cash'
}

/** The design's payment column: "💵 يدفع هنا" vs "✓ تم الدفع". Reuses the
 * patient-side wording so both sides of the loop say the same thing. */
export function getBranchPaymentLabelAr(booking: BranchBooking): string {
  if (isAwaitingCashCollection(booking)) return 'يدفع هنا'
  return getBookingPaymentLabelAr(booking)
}

/** A row whose slot time has already passed — the design greys these. */
export function hasSlotPassed(booking: BranchBooking, now: Date, cairoNowHHMM: string): boolean {
  void now
  return booking.slotTime.slice(0, 5) < cairoNowHHMM
}

/**
 * The fill indicator: "٣/٥ محجوز اليوم". Counts bookings that CONSUME capacity
 * — which is the DB's own definition: `confirm_booking` increments
 * `booked_count` and `cancel_booking` decrements it, so a cancelled booking
 * does not occupy a slot even though the desk still sees its row.
 */
export function countBookedToday(bookings: readonly BranchBooking[]): number {
  return bookings.filter((booking) => booking.status !== 'cancelled').length
}

/** Chips carry the same tone vocabulary as the patient app; `arrived` is the
 * provider-only addition (F07 already added it to the shared map). */
export type ProviderStatusChip = BookingStatusChip

/** Any preparation the patient was told about — the desk needs to know a
 * fasting patient is coming. Empty means absent (no note → no indicator). */
export function requiresPreparation(booking: BranchBooking): boolean {
  return booking.services.some((service) => {
    const note = service.preparationNotesAr
    if (note === null) return false
    const normalized = note.replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.length === 0) return false
    return !['لا يشترط', 'no fasting required'].some((prefix) => normalized.startsWith(prefix))
  })
}
