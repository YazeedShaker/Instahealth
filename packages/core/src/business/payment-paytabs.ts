// PayTabs provider — NOT IMPLEMENTED. Deliberately a documented stub.
//
// ⚠ PARKED BY PRODUCT DECISION, NOT BY BLOCKER (2026-08-04). Test credentials
// now exist and this integration spec is ready — but **v1 ships CASH ONLY**
// because partners asked to collect at the desk while trust is being built.
// Card returns post-market-proof. Nothing here is stale; it is waiting.
// The re-entry point is one line: put 'card' back in
// `OFFERED_PAYMENT_METHODS` (payment.ts), then implement below.
//
// ORIGINAL WHY (superseded — kept for the record): there was no merchant
// account at all while the legal entity was pending. Faking a half-integration
// here would be worse than nothing, so this module throws a specific, catchable
// error and lists EXACTLY what plugs in. `createMockPaymentProvider` is what
// actually ships (SPEC-F06).
//
// NOTE: the payment provider decision CHANGED from Paymob to PayTabs. Any
// remaining "Paymob" reference in the codebase is stale.
//
// ── What this file becomes (PayTabs hosted payment page, dev.paytabs.com) ───
//
// 1 · CREDENTIALS (three, all distinct):
//     · Profile ID   — public-ish, identifies the merchant profile.
//     · Server Key   — SERVER-ONLY. Never in the Expo bundle; anything prefixed
//                      EXPO_PUBLIC_ ships to the device. It belongs in Supabase
//                      Edge Function secrets exclusively.
//     · Client Key   — the only key that may reach the client, and only for the
//                      hosted/embedded page handoff.
//
// 2 · INITIATION is a SERVER call. `initiatePayment` must not call PayTabs from
//     the device (that would need the Server Key). It calls a new Edge Function
//     (`create-payment`) which POSTs to PayTabs `/payment/request` with
//     `tran_type: 'sale'`, `tran_class: 'ecom'`, `cart_id` = our booking id,
//     `cart_amount` = the booking total, `cart_currency: 'EGP'`, the customer
//     details, plus `callback` (server-to-server IPN) and `return` (the URL the
//     patient comes back to). PayTabs replies with `redirect_url` + `tran_ref`
//     → this function returns `{ kind: 'redirect', providerRef: tran_ref,
//     redirectUrl }` and the app opens it.
//
// 3 · SETTLEMENT stays exactly where it is. PayTabs' IPN callback hits a new
//     `paytabs-ipn` Edge Function which:
//       a. VERIFIES THE SIGNATURE FIRST — no exceptions (CLAUDE.md §8). PayTabs
//          sends a `signature` header; recompute HMAC-SHA256 over the sorted,
//          URL-decoded non-empty POST fields keyed with the Server Key and
//          compare in constant time. Reject before touching the DB.
//       b. Maps `payment_result.response_status` ('A' = authorised) to our
//          `PaymentOutcome`.
//       c. Calls `settle-payment` with `{ bookingId: cart_id, method,
//          providerRef: tran_ref, outcome, providerPayload }` — the SAME
//          settlement path the mock uses. That is the whole point of the
//          abstraction: one settlement path, two callers.
//     `settle-payment` is already idempotent, which PayTabs REQUIRES: it
//     retries IPNs until it gets a 2xx.
//
// 4 · METHOD LINEUP DIFFERS from the approved design. PayTabs Egypt supports
//     `creditcard`, `aman`, `meezaqr`, `valu` — there is NO Fawry and NO
//     Vodafone Cash. Our DB constraint currently allows card/fawry/
//     vodafone_cash/orange_cash/cash. Reconciling the two is an OPEN PRODUCT
//     DECISION and will need both a migration and a design revision.
//
// 5 · Also still open: refunds (PayTabs `tran_type: 'refund'` against the
//     original `tran_ref`) — spec'd separately, explicitly out of scope here.

import type { PaymentIntent, PaymentInitiation, PaymentMethod, PaymentProvider } from './payment'

export const PAYTABS_PROVIDER_ID = 'paytabs'

export interface PaytabsConfig {
  profileId: string
  /** SERVER-ONLY. Present only in Edge Function secrets, never in a client bundle. */
  serverKey: string
  clientKey: string
  /** PayTabs regional endpoint, e.g. `https://secure-egypt.paytabs.com`. */
  baseUrl: string
}

/** Thrown by every PayTabs entry point until the integration is built. Callers
 * catch this to fall back to the mock rather than crashing the booking flow. */
export class PaytabsNotConfiguredError extends Error {
  constructor() {
    super(
      'PayTabs is not integrated yet: no merchant account or credentials exist ' +
        '(legal entity pending). Use createMockPaymentProvider until then.',
    )
    this.name = 'PaytabsNotConfiguredError'
  }
}

/**
 * Placeholder factory. Returns a provider whose `initiatePayment` REJECTS —
 * it never silently succeeds, so no code path can accidentally treat an
 * unbuilt integration as a real payment.
 */
export function createPaytabsProvider(_config: PaytabsConfig): PaymentProvider {
  return {
    id: PAYTABS_PROVIDER_ID,
    isSimulated: false,
    supportsMethod: (method: PaymentMethod) => method === 'card',
    initiatePayment: (_intent: PaymentIntent): Promise<PaymentInitiation> =>
      Promise.reject(new PaytabsNotConfiguredError()),
  }
}
