'use client'

import type { BookingOutcome, BranchBooking } from '@instahealth/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  cancelBookingOnBehalf,
  fetchBranchBookings,
  markBookingOutcome,
} from '../lib/bookings/branch-bookings'
import { createClient } from '../lib/supabase/client'

// The ONE data layer behind both Today and Upcoming Days. Extracted in P02
// rather than copied, because the spec's consistency rule ("one row component,
// one outcome-action module, one cancellable-predicate") only holds if the
// realtime and mutation plumbing is shared too.
//
// ─────────────────────────────────────────────────────────────────────────────
// READS ARE OWNED BY TANSTACK QUERY. Three bugs shipped from this file, all of
// them in hand-rolled read orchestration:
//
//   · an out-of-order refetch painted over a newer state (P02 follow-up)
//   · a read that started BEFORE a write was still "newest" by sequence number,
//     so its pre-write answer painted, the action button reverted, and the
//     desk's next click sent the wrong outcome — a cash completion silently
//     lost (#27)
//   · a cached RSC payload repainted the pre-action snapshot on back-navigation,
//     because the first refetch was deliberately skipped (#28)
//
// Each was fixed with more bookkeeping: a monotonic `requestSeq`, an
// invalidate-reads-on-write bump, a mount revalidation. That bookkeeping IS a
// cache library, written badly. TanStack Query was already a dependency and
// already provider-mounted (`app/providers.tsx`) and simply unused. So the
// sequence counter, the manual poll, the focus listener and the mount
// revalidation are gone — replaced by a query key and four options.
//
// ⚠ WHAT DELIBERATELY DID NOT MOVE, and why:
//   · PENDING spans the write AND its confirming refetch. `mutation.isPending`
//     covers only the mutationFn, so the button would re-enable while the
//     confirming read was still in flight — exactly the window #27 closed.
//   · NO OPTIMISTIC STATUS. An optimistic outcome is indistinguishable on screen
//     from a saved one, which is what made #27 invisible. The row shows an
//     outcome only once the server agrees.
//   · The realtime broadcast → DEBOUNCED invalidation. The payload carries no
//     date, so any branch event invalidates the viewed scope and the database
//     answers.
// ─────────────────────────────────────────────────────────────────────────────

const POLL_MS = 60_000

/** A burst of broadcasts collapses into ONE refetch. The nightly auto-close can
 * touch a dozen bookings in the same second, and each one fires its own
 * `bookings_changed` — without this the desk would issue a dozen identical
 * queries and paint a dozen times. Trailing edge, so the refetch reflects the
 * LAST event rather than the first. */
const REFRESH_DEBOUNCE_MS = 400

export interface BranchBookingsState {
  bookings: BranchBooking[]
  loadFailed: boolean
  isConnected: boolean
  newIds: ReadonlySet<string>
  pendingIds: ReadonlySet<string>
  toastAr: string | null
  setToastAr: (message: string | null) => void
  dismissNew: () => void
  refresh: () => Promise<void>
  markOutcome: (bookingId: string, outcome: BookingOutcome) => Promise<void>
  cancelOnBehalf: (bookingId: string, reasonAr: string) => Promise<boolean>
  // ── server-side query state ──
  search: string
  setSearch: (value: string) => void
  status: string | null
  setStatus: (value: string | null) => void
  page: number
  setPage: (value: number) => void
  pageSize: number
  /** Rows matching the FILTER across all pages — not the page length. */
  total: number
  /** A query is in flight. Distinct from the route-level skeleton: the table
   * is already on screen and is being narrowed, not replaced. */
  isQuerying: boolean
}

/** One screenful. Small enough that a desk never scrolls to find a patient,
 * large enough that a normal day needs no paging at all. */
export const BOOKINGS_PAGE_SIZE = 25

/** A search fires on every keystroke otherwise. Long enough to swallow typing,
 * short enough that it never feels laggy. */
const SEARCH_DEBOUNCE_MS = 300

interface BookingsPage {
  bookings: BranchBooking[]
  total: number
}

export function useBranchBookings({
  branchId,
  isoDate,
  initialBookings,
  initialTotal,
  initialLoadFailed,
  trackArrivals,
}: {
  branchId: string
  isoDate: string
  initialBookings: BranchBooking[]
  initialTotal: number
  initialLoadFailed: boolean
  /** Today highlights newly-arrived bookings; a future day does not — every
   * booking on it is "new" in the only sense that matters, so the highlight
   * would be noise. */
  trackArrivals: boolean
}): BranchBookingsState {
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClient(), [])

  const [isConnected, setIsConnected] = useState(false)
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set())
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set())
  const [toastAr, setToastAr] = useState<string | null>(null)

  // What the DATABASE is being asked for. `search` is what the box shows;
  // `appliedSearch` is what has actually been sent, so typing does not fire a
  // query per keystroke.
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [status, setStatusRaw] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  // Narrowing the results must return to page one, or a filter that matches
  // three rows shows an empty page four.
  const setStatus = useCallback((value: string | null) => {
    setStatusRaw(value)
    setPage(0)
  }, [])
  useEffect(() => setPage(0), [appliedSearch])

  // Switching DAYS clears the desk's filters — they belong to the day they were
  // typed on. The DATA needs no help: `isoDate` is part of the query key, so a
  // new day is a different question and gets its own answer.
  const seededDate = useRef(isoDate)
  useEffect(() => {
    if (seededDate.current === isoDate) return
    seededDate.current = isoDate
    setNewIds(new Set())
    setSearch('')
    setAppliedSearch('')
    setStatusRaw(null)
    setPage(0)
  }, [isoDate])

  // ⚠ The server payload answers ONE question: the unfiltered first page of the
  // day it was rendered for. Seeding a filtered or paged key with it would put
  // rows on screen that the desk's own filter excludes — the bug the old
  // `seededDate` guard existed to prevent, now impossible because the key
  // ENCODES the question rather than the component remembering it.
  const isUnfilteredFirstPage = appliedSearch === '' && status === null && page === 0
  const seedApplies = isUnfilteredFirstPage && seededDate.current === isoDate

  // Memoised because `refresh` closes over it: a fresh array every render would
  // rebuild that callback every render for no reason. The key IS the question
  // being asked — anything absent from it is not part of the question, so it
  // must not invalidate the answer.
  const queryKey = useMemo(
    () => ['branch-bookings', branchId, isoDate, appliedSearch, status, page] as const,
    [branchId, isoDate, appliedSearch, status, page],
  )

  const query = useQuery<BookingsPage>({
    queryKey,
    queryFn: () =>
      fetchBranchBookings(supabase, branchId, isoDate, {
        search: appliedSearch,
        status,
        limit: BOOKINGS_PAGE_SIZE,
        offset: page * BOOKINGS_PAGE_SIZE,
      }),
    initialData: seedApplies ? { bookings: initialBookings, total: initialTotal } : undefined,
    // ⚠ ZERO — NOT the provider's 60s default. `app/providers.tsx` sets
    // `staleTime: 60_000` globally, which would let a mount reuse a cached page
    // without refetching and reinstate #28 exactly: come back to Today and the
    // pre-action snapshot repaints. A desk screen has no use for stale data.
    staleTime: 0,
    // Stated twice on purpose: 'always' refetches even when the entry looks
    // fresh, which is what makes back/forward navigation correct — Next serves
    // those from its Router Cache, so the payload can be arbitrarily old.
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: POLL_MS,
    // Keep the previous page on screen while a narrower one loads, so the table
    // is NARROWED rather than replaced by a flash of empty.
    placeholderData: (previous) => previous,
    retry: 1,
  })

  const bookings = query.data?.bookings ?? []
  const total = query.data?.total ?? 0
  // A failed FIRST load is a broken screen. A failed refetch over rows already
  // on display is not, and must not blank the desk.
  const loadFailed = query.data === undefined ? initialLoadFailed || query.isError : false

  /** Force the viewed scope to re-ask the database, and RESOLVE once it has —
   * the awaited-ness is load-bearing for the pending window below. */
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey, refetchType: 'active' })
  }, [queryClient, queryKey])

  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  // ── arrivals ──────────────────────────────────────────────────────────────
  // Only rows the desk has never seen count as new. Tracked on the unfiltered
  // view only: under a filter, every match would flag as "new" the moment it is
  // typed.
  const knownIds = useRef<Set<string>>(new Set(initialBookings.map((row) => row.id)))
  useEffect(() => {
    if (!trackArrivals || !isUnfilteredFirstPage || query.data === undefined) return
    const arrivals = query.data.bookings
      .filter((row) => !knownIds.current.has(row.id))
      .map((row) => row.id)
    for (const row of query.data.bookings) knownIds.current.add(row.id)
    if (arrivals.length > 0) setNewIds((prev) => new Set([...prev, ...arrivals]))
  }, [query.data, trackArrivals, isUnfilteredFirstPage])

  // ── realtime ──────────────────────────────────────────────────────────────
  // Broadcast on a private per-branch topic, NOT postgres_changes — the payload
  // is ids only and the refetch goes back through the RLS-scoped function, so
  // nothing can leak a row the desk should not see.
  //
  // The payload is `{booking_id, op, status}` and carries NO DATE, so it cannot
  // say whether the changed booking belongs to the day on screen. Any branch
  // event therefore invalidates the VIEWED scope and the database answers.
  // (Upgrade path if event volume ever makes this heavy: add the date.)
  useEffect(() => {
    let cancelled = false
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const channel = supabase.channel(`branch-bookings:${branchId}`, {
      config: { private: true },
    })

    const setup = async () => {
      await supabase.realtime.setAuth()
      channel
        .on('broadcast', { event: 'bookings_changed' }, () => {
          if (debounceTimer !== null) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(() => {
            if (!cancelled) void refreshRef.current()
          }, REFRESH_DEBOUNCE_MS)
        })
        .subscribe((state) => {
          if (cancelled) return
          setIsConnected(state === 'SUBSCRIBED')
        })
    }
    void setup()

    return () => {
      cancelled = true
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
  }, [supabase, branchId])

  useEffect(() => {
    if (toastAr === null) return
    const timer = setTimeout(() => setToastAr(null), 5000)
    return () => clearTimeout(timer)
  }, [toastAr])

  // ── writes ────────────────────────────────────────────────────────────────
  /**
   * In-flight writes, keyed by booking id — a REF, not state, because the guard
   * has to hold synchronously. `pendingIds` cannot do this job: a second click
   * arriving before React re-renders reads the OLD set and sails through, which
   * is how a double-click became two writes.
   */
  const writesInFlight = useRef<Set<string>>(new Set())

  /**
   * Hold a booking PENDING across the whole write-then-confirm cycle.
   *
   * ⚠ NOT `useMutation`'s `isPending`, which covers only the mutationFn. The
   * flag is lowered after the CONFIRMING REFETCH has painted, not when the write
   * resolves — that gap was the window in which the desk could click an action
   * the screen was about to contradict, and it cost a cash payment (#27). While
   * pending the row's buttons are disabled, so a stale action cannot be reached.
   */
  const withPending = useCallback(async (bookingId: string, work: () => Promise<void>) => {
    if (writesInFlight.current.has(bookingId)) return
    writesInFlight.current.add(bookingId)
    setPendingIds((prev) => new Set([...prev, bookingId]))
    try {
      await work()
      // Re-read INSIDE the pending window: on success to pick up server-side
      // effects (a cash completion also flips the payment state), on failure to
      // resync. AWAITED, so the row is released only once the screen shows what
      // the database holds.
      await refreshRef.current()
    } finally {
      writesInFlight.current.delete(bookingId)
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(bookingId)
        return next
      })
    }
  }, [])

  /**
   * Record an outcome. THE ROW SHOWS NO OUTCOME UNTIL THE SERVER CONFIRMS IT.
   *
   * There is deliberately no optimistic update. An optimistic status is
   * indistinguishable on screen from a saved one, which is exactly what made the
   * swallowed completion invisible; the feedback in the meantime is the pending
   * affordance on the button (ENGINEERING-WORKFLOW §1.4).
   */
  const markOutcome = useCallback(
    async (bookingId: string, outcome: BookingOutcome) => {
      await withPending(bookingId, async () => {
        const result = await markBookingOutcome(supabase, bookingId, outcome)
        // `unchanged: true` maps to `ok` — the RPC is idempotent, so a
        // double-click that does reach the server twice is a clean no-op and
        // must not raise a toast.
        if (result.kind !== 'ok') {
          setToastAr(
            result.kind === 'illegalTransition'
              ? 'تغيّرت حالة هذا الحجز — حدّثنا القائمة.'
              : result.kind === 'slotInFuture'
                ? 'لا يمكن تسجيل نتيجة لحجز في يوم قادم.'
                : result.kind === 'notAllowed'
                  ? 'لا تملك صلاحية تعديل هذا الحجز.'
                  : 'تعذّر حفظ التغيير — تحقق من الاتصال وحاول مرة أخرى.',
          )
        }
      })
    },
    [supabase, withPending],
  )

  const cancelOnBehalf = useCallback(
    async (bookingId: string, reasonAr: string): Promise<boolean> => {
      let succeeded = false
      await withPending(bookingId, async () => {
        const result = await cancelBookingOnBehalf(supabase, bookingId, reasonAr)
        succeeded = result.kind === 'ok'
        if (result.kind === 'ok') {
          setToastAr('أُلغي الحجز وأُتيح الموعد لمريض آخر.')
        } else {
          setToastAr(
            result.kind === 'notCancellable'
              ? 'تغيّرت حالة هذا الحجز — لم يعد قابلاً للإلغاء.'
              : result.kind === 'notAllowed'
                ? 'لا تملك صلاحية إلغاء هذا الحجز.'
                : 'تعذّر إلغاء الحجز — تحقق من الاتصال وحاول مرة أخرى.',
          )
        }
      })
      return succeeded
    },
    [supabase, withPending],
  )

  const dismissNew = useCallback(() => setNewIds(new Set()), [])

  return {
    bookings,
    loadFailed,
    isConnected,
    newIds,
    pendingIds,
    toastAr,
    setToastAr,
    dismissNew,
    refresh,
    markOutcome,
    cancelOnBehalf,
    search,
    setSearch,
    status,
    setStatus,
    page,
    setPage,
    pageSize: BOOKINGS_PAGE_SIZE,
    total,
    // TanStack's own in-flight flag, which now also covers the poll, the focus
    // refetch and the realtime-triggered invalidation — all of which used to be
    // invisible to the toolbar's "narrowing…" affordance.
    isQuerying: query.isFetching,
  }
}
