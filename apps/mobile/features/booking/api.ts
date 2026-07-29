import { type BranchServiceItem } from '@instahealth/core'

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

/**
 * Creates the pending_payment booking through `create_pending_booking`.
 *
 * ⚠ This used to INSERT `bookings` and `booking_services` straight from the
 * app, sending its own `total_amount` and `price_at_booking`. Nothing checked
 * either: a patient could book a 400 EGP service for 1 EGP (proven on dev,
 * migration 20260729_server_derived_booking_money). The client now sends
 * IDENTITIES only — slot and service ids — and the server derives every money
 * value, rejects unavailable services, and refuses a service that belongs to a
 * different branch. The INSERT policies are gone, so this is the only path.
 *
 * The returned total is AUTHORITATIVE. If a price moved while the patient was
 * choosing, the server's number differs from the one on screen — that is
 * ordinary staleness, not an error, so the caller re-renders the review with
 * `totalEgp` rather than failing the booking.
 */
export async function createPendingBooking(input: {
  userId: string
  branchId: string
  slotId: string
  services: BranchServiceItem[]
  notes: string
}): Promise<PendingBooking> {
  const trimmedNotes = input.notes.trim()

  const { data, error } = await supabase.rpc('create_pending_booking', {
    p_slot_id: input.slotId,
    p_branch_service_ids: input.services.map((service) => service.branchServiceId),
    // `undefined` omits the argument so the SQL default applies; the generated
    // type models the optional parameter, not a nullable one.
    p_notes: trimmedNotes.length > 0 ? trimmedNotes : undefined,
  })
  if (error !== null) {
    logDevError('create_pending_booking', error)
    throw error
  }

  const result = data as {
    success?: boolean
    error?: string
    booking_id?: string
    booking_ref?: string
    total_egp?: number
  } | null

  if (result?.success !== true) {
    const reason = result?.error ?? 'unknown'
    logDevError(`create_pending_booking rejected: ${reason}`, result)
    throw new Error(`create_pending_booking:${reason}`)
  }

  return {
    id: result.booking_id as string,
    bookingRef: result.booking_ref ?? null,
    slotId: input.slotId,
    // What the SERVER charged — the review screen renders this, not its own sum.
    totalEgp: Number(result.total_egp ?? 0),
  }
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
