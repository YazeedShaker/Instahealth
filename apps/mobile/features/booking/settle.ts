import type { BookingConfirmation, PaymentMethod, SettlementResult } from '@instahealth/core'

import { supabase } from '../../lib/supabase'

// The client half of the settlement contract. It calls the `settle-payment`
// Edge Function and NOTHING else — the client has no grant on confirm_booking
// (migration 20260727111326) and no INSERT policy on payments, so this is
// structurally the only way a booking can become confirmed from the app.

function logDevError(context: string, error: unknown): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[payment] ${context} failed:`, error)
  }
}

/** What the payment screen does next. Every server error maps to exactly one
 * of these — no raw error string ever reaches the patient (PRODUCT.md §8). */
export type SettleOutcome =
  | { kind: 'confirmed'; confirmation: BookingConfirmation }
  /** Payment declined; the hold and the booking survive, so retry is offered. */
  | { kind: 'paymentFailed' }
  /** The hold is gone server-side — teardown + the expiry modal. */
  | { kind: 'holdExpired' }
  /** Something else went wrong; the patient can retry. */
  | { kind: 'error' }

interface SettleInput {
  bookingId: string
  method: PaymentMethod
  providerRef: string
  outcome: 'success' | 'failure'
  providerPayload: Record<string, unknown> | null
}

/**
 * Posts a payment outcome for settlement. Non-2xx responses are NOT thrown
 * away: supabase-js wraps them in a FunctionsHttpError whose context holds the
 * real body, and the specific error code is what decides the patient's next
 * step — swallowing it would collapse "card declined" (retry) and "hold gone"
 * (repick) into one useless message.
 */
export async function settlePayment(input: SettleInput): Promise<SettleOutcome> {
  let body: SettlementResult | null = null
  try {
    const { data, error } = await supabase.functions.invoke<SettlementResult>('settle-payment', {
      body: input,
    })
    if (error !== null) {
      logDevError('settle-payment', error)
      const context: unknown = (error as { context?: unknown }).context
      if (context instanceof Response) {
        body = (await context.json().catch(() => null)) as SettlementResult | null
      }
    } else {
      body = data
    }
  } catch (error) {
    logDevError('settle-payment invoke', error)
    return { kind: 'error' }
  }

  if (body === null) return { kind: 'error' }
  if (body.success) return { kind: 'confirmed', confirmation: body.confirmation }

  switch (body.error) {
    case 'payment_failed':
      return { kind: 'paymentFailed' }
    case 'hold_expired':
    // The slot filled under us — same patient experience as an expired hold:
    // the moment is gone, pick again. (Capacity makes this near-impossible,
    // but "near" is not "never".)
    case 'slot_unavailable':
      return { kind: 'holdExpired' }
    default:
      // booking_not_found / not_your_booking / booking_not_payable /
      // invalid_request / server_error — all bugs or tampering, not states the
      // patient can resolve by choosing differently.
      logDevError(`settle-payment rejected: ${body.error}`, body)
      return { kind: 'error' }
  }
}
