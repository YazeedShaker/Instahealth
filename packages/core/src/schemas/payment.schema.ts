import { z } from 'zod'

import { paymentMethodSchema } from './booking.schema'

// Validation for the settlement boundary. `settle-payment` parses the request
// body with this schema BEFORE touching the DB (CLAUDE.md §8: all input
// validated with Zod at the boundary, never trust the client). Messages are
// stable KEYS resolved through getErrorMessage() — the one bilingual pattern.

export const paymentOutcomeSchema = z.enum(['success', 'failure'], {
  errorMap: () => ({ message: 'payment.outcomeInvalid' }),
})

export const settlePaymentRequestSchema = z.object({
  bookingId: z.string().uuid({ message: 'payment.bookingIdInvalid' }),
  method: paymentMethodSchema,
  // The gateway's own reference (mock ref today, PayTabs `tran_ref` later).
  providerRef: z
    .string()
    .min(1, { message: 'payment.providerRefRequired' })
    .max(255, { message: 'payment.providerRefTooLong' }),
  outcome: paymentOutcomeSchema,
  // Raw gateway payload, stored verbatim in payments.gateway_response for
  // reconciliation. Nullable because the mock has nothing to attach.
  providerPayload: z.record(z.unknown()).nullable().default(null),
})

export type SettlePaymentRequestInput = z.input<typeof settlePaymentRequestSchema>
export type SettlePaymentRequest = z.output<typeof settlePaymentRequestSchema>
