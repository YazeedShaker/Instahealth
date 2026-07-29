'use client'

import type { BookingOutcome, BranchBooking } from '@instahealth/core'
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
}

export function useBranchBookings({
  branchId,
  isoDate,
  initialBookings,
  initialLoadFailed,
  trackArrivals,
}: {
  branchId: string
  isoDate: string
  initialBookings: BranchBooking[]
  initialLoadFailed: boolean
  /** Today highlights newly-arrived bookings; a future day does not — every
   * booking on it is "new" in the only sense that matters, so the highlight
   * would be noise. */
  trackArrivals: boolean
}): BranchBookingsState {
  const [bookings, setBookings] = useState<BranchBooking[]>(initialBookings)
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed)
  const [isConnected, setIsConnected] = useState(false)
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set())
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set())
  const [toastAr, setToastAr] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])
  // Kept in a ref so the realtime callback never closes over a stale list.
  const knownIds = useRef<Set<string>>(new Set(initialBookings.map((booking) => booking.id)))

  // Switching days re-seeds everything from the server payload for the new date.
  useEffect(() => {
    setBookings(initialBookings)
    setLoadFailed(initialLoadFailed)
    knownIds.current = new Set(initialBookings.map((booking) => booking.id))
    setNewIds(new Set())
  }, [isoDate, initialBookings, initialLoadFailed])

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchBranchBookings(supabase, branchId, isoDate)
      const arrivals = trackArrivals
        ? rows.filter((row) => !knownIds.current.has(row.id)).map((row) => row.id)
        : []
      for (const row of rows) knownIds.current.add(row.id)
      setBookings(rows)
      setLoadFailed(false)
      if (arrivals.length > 0) setNewIds((prev) => new Set([...prev, ...arrivals]))
    } catch {
      setLoadFailed(true)
    }
  }, [supabase, branchId, isoDate, trackArrivals])

  // ── realtime ──────────────────────────────────────────────────────────────
  // Broadcast on a private per-branch topic, NOT postgres_changes — the payload
  // is ids only and the refetch goes back through the RLS-scoped function, so
  // nothing can leak a row the desk should not see.
  //
  // The payload is `{booking_id, op, status}` and carries NO DATE, so it cannot
  // tell us whether the changed booking belongs to the day on screen. We
  // therefore refetch the VIEWED date on any branch event and let the database
  // answer: if the change was for another day, the query returns the same rows
  // and nothing moves. Filtering client-side would need a date the event does
  // not have. (Upgrade path, if event volume ever makes this heavy: add the
  // date to the broadcast payload.)
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

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
        .subscribe((status) => {
          if (cancelled) return
          setIsConnected(status === 'SUBSCRIBED')
        })
    }
    void setup()

    return () => {
      cancelled = true
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
  }, [supabase, branchId])

  // Fallbacks: refetch on focus and a slow poll for when the socket drops.
  // Neither is the primary path — they are the quiet safety net.
  useEffect(() => {
    const onFocus = () => void refreshRef.current()
    window.addEventListener('focus', onFocus)
    const interval = setInterval(() => void refreshRef.current(), POLL_MS)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (toastAr === null) return
    const timer = setTimeout(() => setToastAr(null), 5000)
    return () => clearTimeout(timer)
  }, [toastAr])

  const withPending = useCallback(async (bookingId: string, work: () => Promise<void>) => {
    setPendingIds((prev) => new Set([...prev, bookingId]))
    try {
      await work()
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(bookingId)
        return next
      })
    }
  }, [])

  const markOutcome = useCallback(
    async (bookingId: string, outcome: BookingOutcome) => {
      if (pendingIds.has(bookingId)) return
      const previous = bookings
      // Optimistic: the desk is busy and a 300ms wait per click is felt.
      setBookings((rows) =>
        rows.map((row) => (row.id === bookingId ? { ...row, status: outcome } : row)),
      )

      await withPending(bookingId, async () => {
        const result = await markBookingOutcome(supabase, bookingId, outcome)
        if (result.kind !== 'ok') {
          setBookings(previous) // rollback
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
      // Re-read either way: on success to pick up server-side effects (a cash
      // completion also flips the payment state), on failure to resync.
      void refresh()
    },
    [bookings, pendingIds, supabase, refresh, withPending],
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
      // Cancelling frees the slot, so the fill indicator must re-derive.
      await refresh()
      return succeeded
    },
    [supabase, refresh, withPending],
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
  }
}
