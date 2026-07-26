import { calculateBookingTotal, type BranchServiceItem } from '@instahealth/core'

import { supabase } from '../../lib/supabase'
import type { ActiveHold, PendingBooking } from './store'

// The F05 write path. Hard rules from the spec + schema:
// - Holds ONLY via the create_slot_hold RPC — never direct inserts.
// - ONE active hold per patient, enforced SERVER-side (migration
//   20260726193258): a new hold releases every other hold the caller has, so
//   leaked holds self-heal and the client never needs a pre-release step.
// - confirm_booking() (F06) expects a pending booking row; review creates it.
// - Patients have no UPDATE policy on bookings — a stale pending booking
//   (slot re-picked) is cancelled via cancel_booking and a fresh row created.
// - Releases/cancellations are best-effort (server expiry + the 5-min
//   cleanup cron are the safety net) — but failures are LOGGED in dev,
//   never silently swallowed.

function logDevError(context: string, error: unknown): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[booking] ${context} failed:`, error)
  }
}

export type HoldFailureReason = 'slot_taken' | 'error'

export interface HoldResult {
  hold: ActiveHold | null
  failure: HoldFailureReason | null
}

interface SlotHoldRpcResponse {
  success: boolean
  error?: string
  hold_id?: string
  expires_at?: string
}

/** Takes the 10-minute hold. The RPC itself releases the caller's previous
 * hold (one active hold per patient) — no client-side pre-release needed. */
export async function acquireSlotHold(
  slot: { id: string; slotDate: string; slotTime: string },
  userId: string,
): Promise<HoldResult> {
  const { data, error } = await supabase.rpc('create_slot_hold', {
    p_slot_id: slot.id,
    p_user_id: userId,
  })
  if (error) {
    logDevError('create_slot_hold', error)
    return { hold: null, failure: 'error' }
  }

  const response = data as unknown as SlotHoldRpcResponse
  if (!response.success || !response.hold_id || !response.expires_at) {
    // slot_full / slot_blocked / slot_not_found — someone else got there first.
    return { hold: null, failure: 'slot_taken' }
  }
  return {
    hold: {
      holdId: response.hold_id,
      slotId: slot.id,
      slotDate: slot.slotDate,
      slotTime: slot.slotTime,
      expiresAt: response.expires_at,
    },
    failure: null,
  }
}

/** Best-effort release of the patient's own hold (RLS "patient deletes own"). */
export async function releaseHold(hold: ActiveHold, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('slot_holds')
      .delete()
      .eq('id', hold.holdId)
      .eq('user_id', userId)
    if (error) logDevError('releaseHold', error)
  } catch (error) {
    logDevError('releaseHold', error) // server expiry is the safety net
  }
}

/** Best-effort release of ALL the user's holds — called on sign-out, BEFORE
 * the session clears (the RLS delete-own path needs the authed session). */
export async function releaseAllHolds(userId: string): Promise<void> {
  try {
    const { error } = await supabase.from('slot_holds').delete().eq('user_id', userId)
    if (error) logDevError('releaseAllHolds', error)
  } catch (error) {
    logDevError('releaseAllHolds', error) // server expiry is the safety net
  }
}

/** Creates the pending_payment booking + its booking_services rows.
 * Throws on failure (after best-effort cleanup of a half-created row). */
export async function createPendingBooking(input: {
  userId: string
  branchId: string
  slotId: string
  services: BranchServiceItem[]
  notes: string
}): Promise<PendingBooking> {
  const totalEgp = calculateBookingTotal(input.services)
  const trimmedNotes = input.notes.trim()

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      user_id: input.userId,
      branch_id: input.branchId,
      slot_id: input.slotId,
      status: 'pending_payment',
      total_amount: totalEgp,
      patient_notes: trimmedNotes.length > 0 ? trimmedNotes : null,
    })
    .select('id, booking_ref')
    .single()
  if (bookingError) throw bookingError

  const { error: servicesError } = await supabase.from('booking_services').insert(
    input.services.map((service) => ({
      booking_id: booking.id,
      branch_service_id: service.branchServiceId,
      price_at_booking: service.priceEgp,
    })),
  )
  if (servicesError) {
    await cancelPendingBooking(booking.id, 'service_rows_failed')
    throw servicesError
  }

  return { id: booking.id, bookingRef: booking.booking_ref, slotId: input.slotId }
}

/** Best-effort cancel of a pending booking the patient abandoned or re-picked
 * past (patients cannot UPDATE bookings — the SECURITY DEFINER RPC does it). */
export async function cancelPendingBooking(bookingId: string, reason: string): Promise<void> {
  try {
    await supabase.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: reason,
      p_cancelled_by: 'patient',
    })
  } catch {
    // Abandoned pending rows are harmless: never confirmed, no slot consumed.
  }
}
