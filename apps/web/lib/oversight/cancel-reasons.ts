// ⚠ THIS LIST LIVES IN ITS OWN MODULE FOR A REASON, AND THE REASON IS A BUG.
//
// It started as an export from `app/admin/oversight-actions.ts`, which carries
// `'use server'`. A server-actions module may export ONLY async functions —
// a plain `const` is not a valid export from one. That compiles, typechecks and
// lints without complaint, and then fails at RUNTIME the moment a client
// component imports it: `/admin/bookings` rendered nothing at all and the E2E
// found it (`admin-bookings` never appeared, though the URL had changed).
//
// So the list sits in a module with no `'use server'` and no server imports,
// and both sides read the SAME one — the confirm's dropdown and the Zod enum
// that guards the action. The server function's CHECK constraint is still the
// enforcement; this is what stops the UI offering an option the server will
// refuse.

export const CANCEL_REASONS = [
  { code: 'partner_unavailable', labelAr: 'الفرع غير متاح' },
  { code: 'patient_request', labelAr: 'بطلب من المريض' },
  { code: 'duplicate', labelAr: 'حجز مكرر' },
  { code: 'test_booking', labelAr: 'حجز تجريبي' },
  { code: 'other', labelAr: 'سبب آخر' },
] as const

export type CancelReasonCode = (typeof CANCEL_REASONS)[number]['code']

/** The same five codes as a tuple, so Zod and the dropdown cannot drift. */
export const CANCEL_REASON_CODES = CANCEL_REASONS.map((reason) => reason.code) as unknown as [
  CancelReasonCode,
  ...CancelReasonCode[],
]
