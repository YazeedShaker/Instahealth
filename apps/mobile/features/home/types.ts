import type { BranchHours, LatLng } from '@instahealth/core'

/** The shape Home renders — mapped once from the joined query, never re-derived in UI. */
export interface HomeBranch {
  id: string
  nameAr: string
  providerNameAr: string
  lat: number | null
  lng: number | null
  hours: BranchHours | null
  rating: number
  reviewCount: number
  /** ACTIVE category slugs this branch actually serves (labs/scans/…). */
  categorySlugs: string[]
}

export interface HomeBranchWithDistance extends HomeBranch {
  distanceKm: number | null
}

export type CategoryFilter = 'labs' | 'scans' | null

export interface UserLocation {
  coords: LatLng | null
  areaLabel: string
}
