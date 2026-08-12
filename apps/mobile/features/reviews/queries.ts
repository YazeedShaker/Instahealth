import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../../lib/supabase'
import type { BranchReview, BranchReviewSummary, MyReview, ProviderReviewSummary } from './types'

// F08 — reads and the one write, per the Reviews Display Addendum.
//
// ⚠ EVERY PREDICATE LIVES IN THE DATABASE. None of these hooks filters, sorts
// or averages anything: the three read functions already exclude hidden reviews
// EXPLICITLY (not via RLS, which would answer differently for an admin), and
// re-deriving any of it here would be a second predicate to keep in step
// (§5a①). The client's whole job is to ask and to render.

/** The average, the count and the five distribution bars for one branch. */
export function useBranchReviewSummary(branchId: string | undefined) {
  return useQuery({
    queryKey: ['branch-review-summary', branchId],
    enabled: branchId !== undefined && branchId.length > 0,
    queryFn: async (): Promise<BranchReviewSummary> => {
      const { data, error } = await supabase.rpc('get_branch_review_summary', {
        p_branch_id: branchId as string,
      })
      if (error) throw error
      return data as unknown as BranchReviewSummary
    },
  })
}

/** Published reviews, newest first. The same function serves the three-card
 *  preview and the full list, so the two can never disagree about the set. */
export function useBranchReviews(
  branchId: string | undefined,
  limit: number,
  offset = 0,
  enabled = true,
) {
  return useQuery({
    queryKey: ['branch-reviews', branchId, limit, offset],
    enabled: enabled && branchId !== undefined && branchId.length > 0,
    queryFn: async (): Promise<BranchReview[]> => {
      const { data, error } = await supabase.rpc('get_branch_reviews', {
        p_branch_id: branchId as string,
        p_limit: limit,
        p_offset: offset,
      })
      if (error) throw error
      return (data ?? []) as unknown as BranchReview[]
    },
  })
}

/**
 * The provider's OTHER branches — only ever needed by the zero state.
 *
 * ⚠ `enabled` is the caller's decision and it matters: this is a second round
 * trip that a branch WITH reviews must never make. Frame C is the only consumer.
 */
export function useProviderReviewSummary(
  providerId: string | undefined,
  excludeBranchId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['provider-review-summary', providerId, excludeBranchId],
    enabled: enabled && providerId !== undefined && providerId.length > 0,
    queryFn: async (): Promise<ProviderReviewSummary> => {
      const { data, error } = await supabase.rpc('get_provider_review_summary', {
        p_provider_id: providerId as string,
        p_exclude_branch_id: excludeBranchId ?? undefined,
        p_limit: 3,
      })
      if (error) throw error
      return data as unknown as ProviderReviewSummary
    },
  })
}

/**
 * The caller's own review of one booking — hidden or not.
 *
 * ⚠ THIS IS WHAT KEEPS THE PROMPT HONEST. The public SELECT policy hides a
 * moderated review from its own author, so reading the table directly would say
 * "no review" for a booking that has one, offer the prompt again, and dead-end
 * on the UNIQUE constraint. `get_my_review` is a DEFINER read that can see it.
 */
export function useMyReview(bookingId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['my-review', bookingId],
    enabled: enabled && bookingId !== undefined && bookingId.length > 0,
    queryFn: async (): Promise<MyReview> => {
      const { data, error } = await supabase.rpc('get_my_review', {
        p_booking_id: bookingId as string,
      })
      if (error) throw error
      return data as unknown as MyReview
    },
  })
}

export interface SubmitReviewResult {
  ok: boolean
  error?: string
  reviewId?: string
  displayName?: string
}

/**
 * Submit the one review this booking will ever have.
 *
 * ⚠ IT SENDS A BOOKING ID, A RATING AND WORDS — AND NOTHING ELSE. No user id,
 * no branch id: the server derives both from the booking, matched on
 * `auth.uid()`. There is deliberately no parameter here that could carry a lie.
 *
 * ⚠ AND IT DOES NOT THROW ON A REFUSAL. `submit_review` returns
 * `{ok: false, error}` for every business refusal — already reviewed, not
 * completed, not yours — because those are answers, not faults. Only a
 * transport failure throws.
 */
export function useSubmitReview(bookingId: string | undefined, branchId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      rating: number
      comment: string | null
    }): Promise<SubmitReviewResult> => {
      const { data, error } = await supabase.rpc('submit_review', {
        p_booking_id: bookingId as string,
        p_rating: input.rating,
        // The generated signature types the optional comment as `string |
        // undefined`; NULL and "absent" mean the same thing to the function,
        // which stores NULLIF(BTRIM(...), '') either way.
        p_comment: input.comment ?? undefined,
      })
      if (error) throw error
      return data as unknown as SubmitReviewResult
    },
    onSuccess: async (result) => {
      if (!result.ok) return
      // The aggregate moved server-side the instant the row landed (the trigger
      // owns it), so the branch surfaces must re-ask rather than assume.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-review', bookingId] }),
        queryClient.invalidateQueries({ queryKey: ['branch-review-summary', branchId] }),
        queryClient.invalidateQueries({ queryKey: ['branch-reviews', branchId] }),
        queryClient.invalidateQueries({ queryKey: ['branch', branchId] }),
      ])
    },
  })
}
