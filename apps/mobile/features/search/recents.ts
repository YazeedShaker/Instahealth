import AsyncStorage from '@react-native-async-storage/async-storage'
import { addRecentSearch, removeRecentSearch } from '@instahealth/core'
import { useCallback, useEffect, useState } from 'react'

// Recent searches — LOCAL ONLY (SPEC-F03: no server persistence). List logic
// (newest-first, hamza-insensitive dedupe, cap 8) lives in core and is
// unit-tested there; this hook only does the AsyncStorage plumbing.

const STORAGE_KEY = 'ih.search.recents.v1'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

export function useRecentSearches() {
  // null = not loaded yet — the initial state must not flash an empty list
  // and then pop the real one in.
  const [recents, setRecents] = useState<string[] | null>(null)

  useEffect(() => {
    let isMounted = true
    void AsyncStorage.getItem(STORAGE_KEY).then(
      (stored) => {
        if (!isMounted) return
        try {
          const parsed: unknown = stored === null ? [] : JSON.parse(stored)
          setRecents(isStringArray(parsed) ? parsed : [])
        } catch {
          setRecents([])
        }
      },
      () => {
        if (isMounted) setRecents([])
      },
    )
    return () => {
      isMounted = false
    }
  }, [])

  const persist = useCallback((next: string[]) => {
    setRecents(next)
    // Fire-and-forget: losing a recent search on a storage error is cosmetic.
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined)
  }, [])

  const add = useCallback(
    (query: string) => persist(addRecentSearch(recents ?? [], query)),
    [recents, persist],
  )
  const remove = useCallback(
    (query: string) => persist(removeRecentSearch(recents ?? [], query)),
    [recents, persist],
  )
  const clear = useCallback(() => persist([]), [persist])

  return { recents, add, remove, clear }
}
