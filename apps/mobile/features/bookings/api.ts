import { supabase } from '../../lib/supabase'

// Cancellation goes through the `cancel_booking` RPC — patients have no UPDATE
// policy on `bookings`. The RPC is SECURITY DEFINER and, since migration
// 20260728120808, checks that the caller actually owns the booking (before
// that, any signed-in patient could cancel anyone's booking by id).

/** What the cancel sheet does next. Every server error maps to exactly one of
 * these — no raw error string ever reaches the patient (PRODUCT.md §8). */
export type CancelOutcome =
  | { kind: 'cancelled' }
  /** Already cancelled or completed — the list is simply out of date. */
  | { kind: 'notCancellable' }
  /** The appointment has already started. The server enforces the SAME
   * boundary the cancel button uses, so this only happens if the slot ticked
   * over between opening the sheet and confirming. */
  | { kind: 'slotStarted' }
  /** Not found, not ours, or the connection failed. */
  | { kind: 'error' }

function logDevError(context: string, error: unknown): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[bookings] ${context} failed:`, error)
  }
}

export async function cancelBooking(bookingId: string): Promise<CancelOutcome> {
  try {
    const { data, error } = await supabase.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_reason: 'patient_cancelled',
      p_cancelled_by: 'patient',
    })
    if (error !== null) {
      logDevError('cancel_booking', error)
      return { kind: 'error' }
    }

    const result = data as { success?: boolean; error?: string } | null
    if (result?.success === true) return { kind: 'cancelled' }
    // `booking_not_found` covers "not yours" too — the function refuses to
    // confirm that someone else's booking id exists.
    if (result?.error === 'cannot_cancel') return { kind: 'notCancellable' }
    if (result?.error === 'slot_started') return { kind: 'slotStarted' }
    logDevError(`cancel_booking rejected: ${result?.error ?? 'unknown'}`, result)
    return { kind: 'error' }
  } catch (error) {
    logDevError('cancel_booking threw', error)
    return { kind: 'error' }
  }
}
