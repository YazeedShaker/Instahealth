import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { supabase } from '../../lib/supabase'

const RETRY_DELAY_MS = 5_000

function logDev(message: string, detail?: unknown): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[realtime] ${message}`, detail ?? '')
  }
}

// Live slot availability: the DB broadcasts on every hold INSERT/DELETE to
// the private topic `branch-holds:{branchId}` (trigger, migration
// 20260726205901 — payload is slot ids only, never user data). Any event →
// refetch this branch's availability. The slow poll on the slots query stays
// as the fallback for silent time-expiry and dropped sockets; this hook is
// the fast path, not a correctness requirement.
//
// Hardened after a silent-failure hunt: the JWT is fetched and set on the
// socket BEFORE joining (private channels authorize against it — joining
// with the anon key gets rejected), every channel status is logged in dev,
// failed joins retry on a timer, and each successful (re)join triggers one
// catch-up refetch so no broadcast window is ever missed.
export function useBranchHoldsRealtime(branchId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (branchId === null) return
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let activeChannel: ReturnType<typeof supabase.channel> | null = null

    const refetchAvailability = () => {
      void queryClient.invalidateQueries({ queryKey: ['booking', 'slots', branchId] })
      void queryClient.invalidateQueries({ queryKey: ['branch', branchId, 'slots-preview'] })
    }

    const teardown = () => {
      if (retryTimer !== null) clearTimeout(retryTimer)
      retryTimer = null
      // ⚠ NULL IT FIRST. `removeChannel` closes the channel, which fires the
      // subscribe callback with CLOSED *synchronously* — and now that CLOSED
      // schedules a retry, a teardown that still held a reference would
      // re-enter itself and remove the same channel twice.
      const dead = activeChannel
      activeChannel = null
      if (dead !== null) void supabase.removeChannel(dead)
    }

    const scheduleRetry = () => {
      if (cancelled || retryTimer !== null) return
      retryTimer = setTimeout(() => {
        retryTimer = null
        void join()
      }, RETRY_DELAY_MS)
    }

    const join = async () => {
      if (cancelled) return
      // Private channels authorize against the user JWT. Set it on the
      // socket DETERMINISTICALLY before joining — relying on auth-event
      // wiring races the join and gets rejected with the anon key.
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token
      if (cancelled) return
      if (accessToken === undefined) {
        logDev('no session for private channel — retrying')
        scheduleRetry()
        return
      }
      await supabase.realtime.setAuth(accessToken)
      if (cancelled) return

      activeChannel = supabase
        .channel(`branch-holds:${branchId}`, { config: { private: true } })
        .on('broadcast', { event: 'holds_changed' }, refetchAvailability)
        .subscribe((status, err) => {
          if (cancelled) return
          if (status === 'SUBSCRIBED') {
            logDev(`joined branch-holds:${branchId}`)
            refetchAvailability() // catch up on anything missed while joining
            return
          }
          // ⚠ `CLOSED` BELONGS IN THIS LIST, AND ITS ABSENCE WAS THE HOLE.
          // This hook was already "hardened with a retry" and still died
          // permanently on the most ordinary failure there is — a phone losing
          // signal — because a dropped socket reports CLOSED, not CHANNEL_ERROR.
          // Measured on the web twin, which shares this library and had the
          // same gap: offline → `state=CLOSED chan=closed`, then nothing ever
          // again. Retrying on the two loud states while ignoring the quiet one
          // is how a fallback that looks present turns out never to run.
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            logDev(`channel ${status} for branch-holds:${branchId}`, err?.message)
            teardown()
            scheduleRetry()
          }
        })
    }

    void join()
    return () => {
      cancelled = true
      teardown()
    }
  }, [branchId, queryClient])
}
