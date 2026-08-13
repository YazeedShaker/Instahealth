'use client'

import { useEffect, useState } from 'react'

import { createClient } from '../lib/supabase/client'

// P02 — the patient's review of a visit, for the desk's drawer.
//
// ⚠ READ-ONLY, AND PUBLISHED ONLY. The provider portal has no moderation: the
// desk sees exactly what a patient browsing the branch page sees, and nothing
// else. Hiding and restoring belong to the admin (`admin_set_review_hidden`),
// which is the same two-portal authority split that keeps «تسجيل الوصول» out of
// the admin drawer — each portal can do the thing only it should be able to do.
//
// ⚠ `is_flagged = false` IS STATED, not inherited from RLS. The policy reads
// `is_flagged = false OR get_user_role() = 'admin'`, and a provider is never an
// admin — so RLS alone would be correct here today. Stating it anyway means the
// query cannot start returning hidden reviews if someone ever holds both roles,
// and it keeps the predicate visible at the call site (§5a①).

export interface BookingReview {
  reviewId: string
  rating: number
  comment: string | null
  displayName: string
  createdAt: string
}

export function useBookingReview(bookingId: string | null): BookingReview | null {
  const [review, setReview] = useState<BookingReview | null>(null)

  useEffect(() => {
    if (bookingId === null) {
      setReview(null)
      return
    }
    let cancelled = false
    const supabase = createClient()

    void (async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, comment, display_name, created_at')
        .eq('booking_id', bookingId)
        .eq('is_flagged', false)
        .maybeSingle()

      if (cancelled) return
      // ⚠ An error is treated as ABSENT, deliberately. The desk's drawer is not
      // the place to surface a read failure about an optional section — showing
      // a broken review block would be worse than showing none, and «empty
      // means absent» is the rule this section follows anyway.
      if (error !== null || data === null) {
        setReview(null)
        return
      }
      setReview({
        reviewId: data.id,
        rating: data.rating,
        comment: data.comment,
        displayName: data.display_name ?? 'مريض',
        createdAt: data.created_at ?? new Date().toISOString(),
      })
    })()

    return () => {
      cancelled = true
    }
  }, [bookingId])

  return review
}
