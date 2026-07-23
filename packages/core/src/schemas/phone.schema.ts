import { z } from 'zod'

import { normalizeEgyptianPhone } from '../business/phone'

/** Validates Egyptian mobile input and TRANSFORMS it to E.164 (`+201012345678`).
 * Accepts Arabic-Indic digits and all real-world prefix forms — see business/phone.ts. */
export const phoneSchema = z
  .string({ message: 'phone.required' })
  .min(1, { message: 'phone.required' })
  .transform((value, ctx) => {
    const normalized = normalizeEgyptianPhone(value)
    if (normalized === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'phone.invalid' })
      return z.NEVER
    }
    return normalized
  })

export type NormalizedPhone = z.infer<typeof phoneSchema>
