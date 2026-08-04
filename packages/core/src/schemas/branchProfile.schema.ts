import { z } from 'zod'

import {
  BRANCH_ADDRESS_MAX_LENGTH,
  normalizeBranchPhone,
  normalizeBranchWhatsapp,
} from '../business/branch-profile'

// The branch profile edit payload (P05). Mirrors `update_branch_profile`'s
// server-side rules — the server remains the boundary; this is the form's
// while-typing mirror. Optional fields collapse empty → null so the payload
// states absence explicitly instead of sending ''.

const optionalTrimmed = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? ''
    return trimmed.length === 0 ? null : trimmed
  })

export const branchProfileSchema = z.object({
  phone: z
    .string({ message: 'branchProfile.phone.required' })
    .min(1, { message: 'branchProfile.phone.required' })
    .transform((value, ctx) => {
      const normalized = normalizeBranchPhone(value)
      if (normalized === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'branchProfile.phone.invalid' })
        return z.NEVER
      }
      return normalized
    }),
  whatsapp: optionalTrimmed.transform((value, ctx) => {
    if (value === null) return null
    const normalized = normalizeBranchWhatsapp(value)
    if (normalized === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'branchProfile.whatsapp.invalid' })
      return z.NEVER
    }
    return normalized
  }),
  addressAr: z.string({ message: 'branchProfile.addressAr.required' }).transform((value, ctx) => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'branchProfile.addressAr.required' })
      return z.NEVER
    }
    if (trimmed.length > BRANCH_ADDRESS_MAX_LENGTH) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'branchProfile.address.tooLong' })
      return z.NEVER
    }
    return trimmed
  }),
  addressEn: optionalTrimmed.transform((value, ctx) => {
    if (value === null) return null
    if (value.length > BRANCH_ADDRESS_MAX_LENGTH) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'branchProfile.address.tooLong' })
      return z.NEVER
    }
    return value
  }),
})

export type BranchProfileInput = z.input<typeof branchProfileSchema>
export type BranchProfilePayload = z.output<typeof branchProfileSchema>
