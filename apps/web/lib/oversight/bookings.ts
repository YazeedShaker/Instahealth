import { createClient } from '../supabase/server'

// A06 + A07 — the oversight reads. All RPCs: every one answers a question a
// plain SELECT cannot (network-wide search across providers, cron run history
// no client can read, and commission figures that MUST come from A02's own
// helpers rather than from arithmetic on this side of the wire).

export type BookingStatus =
  'pending_payment' | 'confirmed' | 'arrived' | 'completed' | 'cancelled' | 'no_show'

export interface OversightRow {
  bookingId: string
  bookingRef: string
  status: BookingStatus
  cancelledBy: string | null
  slotDate: string
  slotTime: string
  branchNameAr: string
  providerNameAr: string
  patientNameAr: string | null
  totalEgp: number | null
}

/** The «عمولة متوقعة» chip. `kind` is decided server-side from the booking's
 *  status — the screen never infers it. */
export interface CommissionView {
  kind: 'expected' | 'actual' | 'none' | 'unknown'
  reasonAr?: string
  percent?: number
  commissionPiasters?: number
  totalEgp?: number
  eventDate?: string
  statementMonth?: string
}

export interface OversightDetail {
  found: boolean
  bookingId: string
  bookingRef: string
  status: BookingStatus
  cancelledBy: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  createdAt: string
  slotDate: string
  slotTime: string
  branchNameAr: string
  branchPhone: string | null
  providerNameAr: string
  patientNameAr: string | null
  patientPhone: string | null
  totalEgp: number | null
  paymentStatus: string | null
  services: { nameAr: string; priceEgp: number | null }[]
  commission: CommissionView | null
  adminHistory: {
    action: string
    reasonCode: string | null
    reasonNote: string | null
    changedAt: string
    who: string
  }[]
  /** F08 — the patient's review of this visit, if one exists. NULL for a
   *  booking that was never completed or never rated. */
  review: BookingReview | null
}

/** ⚠ `isPublished` is the ADMIN's view of the dial, and the admin is the only
 *  reader who can see a hidden review at all — that is the entire point of the
 *  moderation surface. Patients get `is_flagged = false` rows only. */
export interface BookingReview {
  reviewId: string
  rating: number
  comment: string | null
  displayName: string | null
  isPublished: boolean
  createdAt: string
}

export interface OpsAlert {
  kind: 'slot_generation_stale' | 'branch_no_bookable_slots_today' | 'branch_no_active_staff'
  severity: 'high' | 'medium'
  lastSuccessAt?: string | null
  affectedBranches?: number
  branches?: {
    branchId: string
    branchNameAr: string
    lastBookableDate?: string | null
    upcomingBookings?: number
  }[]
}

export interface OpsOverview {
  today: string
  cards: {
    bookingsToday: number
    cancellationsToday: number
    fillPercent: number
    capacityToday: number
    bookedToday: number
    expectedCommissionPiasters: number
  }
  alerts: OpsAlert[]
  checked: string[]
  network: { activeBranches: number; openSlots: number }
  lastGenerationAt: string | null
}

export async function fetchAdminBookings(params: {
  search?: string
  providerId?: string
  status?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}): Promise<{ bookings: OversightRow[]; total: number }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_admin_bookings', {
    p_search: params.search ?? undefined,
    p_provider_id: params.providerId ?? undefined,
    p_status: params.status ?? undefined,
    p_from: params.from ?? undefined,
    p_to: params.to ?? undefined,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
  })
  if (error) throw error
  return data as unknown as { bookings: OversightRow[]; total: number }
}

export async function fetchAdminBookingDetail(bookingId: string): Promise<OversightDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_admin_booking_detail', {
    p_booking_id: bookingId,
  })
  if (error) throw error
  const result = data as unknown as OversightDetail
  if (result?.found !== true) return null

  // ⚠ A SEPARATE READ, NOT A CHANGE TO THE RPC. `get_admin_booking_detail` is
  // A06's contract and several assertions depend on its shape; a review is an
  // independent fact about the booking, and the admin SELECT policy already
  // lets it through INCLUDING hidden rows («reviews: public read unflagged»
  // ends with `OR get_user_role() = 'admin'`). Fetching it here keeps F08 from
  // reshaping a proven function.
  const { data: review, error: reviewError } = await supabase
    .from('reviews')
    .select('id, rating, comment, display_name, is_flagged, created_at')
    .eq('booking_id', bookingId)
    .maybeSingle()
  if (reviewError) throw reviewError

  return {
    ...result,
    review:
      review === null
        ? null
        : {
            reviewId: review.id,
            rating: review.rating,
            comment: review.comment,
            displayName: review.display_name,
            isPublished: review.is_flagged !== true,
            createdAt: review.created_at ?? new Date().toISOString(),
          },
  }
}

export async function fetchOpsOverview(): Promise<OpsOverview> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_ops_overview')
  if (error) throw error
  return data as unknown as OpsOverview
}

export interface ProviderOption {
  providerId: string
  nameAr: string
}

export async function fetchProviderOptions(): Promise<ProviderOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('providers')
    .select('id, name_ar')
    .eq('is_active', true)
    .order('name_ar')
  if (error) throw error
  return (data ?? []).map((row) => ({ providerId: row.id, nameAr: row.name_ar }))
}
