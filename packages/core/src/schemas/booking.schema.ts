import { z } from 'zod'

import { uuidSchema } from './common.schema'

// Payment methods accepted by the bookings CHECK constraint / confirm_booking().
export const PAYMENT_METHODS = ['card', 'fawry', 'vodafone_cash', 'orange_cash', 'cash'] as const

export const paymentMethodSchema = z.enum(PAYMENT_METHODS, {
  message: 'booking.paymentMethod.invalid',
})

/** Service selection on the branch profile — min 1, all from the same branch. */
export const serviceSelectionSchema = z
  .object({
    branchId: uuidSchema,
    services: z
      .array(
        z.object({
          branchServiceId: uuidSchema,
          branchId: uuidSchema,
        }),
      )
      .min(1, { message: 'booking.services.empty' }),
  })
  .refine(
    (selection) => selection.services.every((service) => service.branchId === selection.branchId),
    {
      message: 'booking.services.mixedBranch',
      path: ['services'],
    },
  )

/** Slot choice — the tap that starts a hold. */
export const slotChoiceSchema = z.object({
  slotId: uuidSchema,
})

/** Payload for the `create_slot_hold` RPC. */
export const createSlotHoldSchema = z.object({
  slotId: uuidSchema,
  userId: uuidSchema,
})

/** Payload for the `confirm_booking` RPC. Gateway fields only exist for gateway payments. */
export const confirmBookingSchema = z.object({
  bookingId: uuidSchema,
  paymentMethod: paymentMethodSchema,
  gatewayTxnId: z.string().min(1).optional(),
  gatewayOrderId: z.string().min(1).optional(),
  gatewayResponse: z.unknown().optional(),
})

export type PaymentMethod = z.infer<typeof paymentMethodSchema>
export type ServiceSelection = z.infer<typeof serviceSelectionSchema>
export type SlotChoice = z.infer<typeof slotChoiceSchema>
export type CreateSlotHoldInput = z.infer<typeof createSlotHoldSchema>
export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>
