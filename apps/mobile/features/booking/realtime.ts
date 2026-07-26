import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { supabase } from '../../lib/supabase'

// Live slot availability: the DB broadcasts on every hold INSERT/DELETE to
// the private topic `branch-holds:{branchId}` (trigger, migration
// realtime_hold_broadcasts — payload is slot ids only, never user data).
// Any event → refetch this branch's availability. The slow poll on the
// slots query stays as the fallback for silent time-expiry and dropped
// sockets; this hook is the fast path, not a correctness requirement.
export function useBranchHoldsRealtime(branchId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (branchId === null) return
    // Private channels authorize against the user's JWT — make sure the
    // realtime socket carries the current session token before joining.
    void supabase.realtime.setAuth()
    const channel = supabase
      .channel(`branch-holds:${branchId}`, { config: { private: true } })
      .on('broadcast', { event: 'holds_changed' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['booking', 'slots', branchId] })
        void queryClient.invalidateQueries({ queryKey: ['branch', branchId, 'slots-preview'] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [branchId, queryClient])
}
