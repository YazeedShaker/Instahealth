import { z } from 'zod'

import { uuidSchema } from './common.schema'

export const REVIEW_COMMENT_MAX_LENGTH = 500

export const reviewSchema = z.object({
  bookingId: uuidSchema,
  rating: z
    .number({ message: 'review.rating.range' })
    .int({ message: 'review.rating.range' })
    .min(1, { message: 'review.rating.range' })
    .max(5, { message: 'review.rating.range' }),
  comment: z
    .string()
    .trim()
    .max(REVIEW_COMMENT_MAX_LENGTH, { message: 'review.comment.tooLong' })
    .optional(),
})

export type ReviewInput = z.infer<typeof reviewSchema>
