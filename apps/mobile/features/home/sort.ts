// Pure sorting rule for the nearby list (unit-tested):
// - With a user location: coordinate branches sorted by distance ascending;
//   NULL-coordinate branches go to the END sorted by name — no distance label,
//   never NaN, never a crash.
// - Without a location (denied/unavailable): everything sorted by name.

import { computeDistanceKm, type LatLng } from '@instahealth/core'

interface SortableBranch {
  nameAr: string
  lat: number | null
  lng: number | null
}

export function sortBranchesForDisplay<T extends SortableBranch>(
  branches: T[],
  origin: LatLng | null,
): (T & { distanceKm: number | null })[] {
  const byNameAr = (a: T, b: T) => a.nameAr.localeCompare(b.nameAr, 'ar')

  if (origin === null) {
    return [...branches].sort(byNameAr).map((branch) => ({ ...branch, distanceKm: null }))
  }

  const withCoords = branches
    .filter((branch) => branch.lat !== null && branch.lng !== null)
    .map((branch) => ({
      ...branch,
      distanceKm: computeDistanceKm(origin, {
        lat: branch.lat as number,
        lng: branch.lng as number,
      }),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)

  const withoutCoords = branches
    .filter((branch) => branch.lat === null || branch.lng === null)
    .sort(byNameAr)
    .map((branch) => ({ ...branch, distanceKm: null }))

  return [...withCoords, ...withoutCoords]
}
