import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { ensureProfile } from './profile'
import { useAuthStore } from './store'

// Fetches (and on first sign-in, creates) the patient's profile row, then
// syncs it into the auth store. TanStack Query owns the fetch; the store owns state.
export function useProfile() {
  const session = useAuthStore((state) => state.session)
  const setProfile = useAuthStore((state) => state.setProfile)

  const userId = session?.user.id
  const phone = session?.user.phone

  const query = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => ensureProfile(userId as string, `+${phone as string}`),
    enabled: userId !== undefined && phone !== undefined,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (query.data) setProfile(query.data)
  }, [query.data, setProfile])

  return query
}
