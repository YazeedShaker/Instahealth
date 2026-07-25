import type { BranchHours, BranchServiceItem } from '@instahealth/core'

/** The shape the branch profile renders — mapped once from the joined query,
 * never re-derived in UI. Services are already filtered to available +
 * active + active-category. */
export interface BranchProfile {
  id: string
  nameAr: string
  providerNameAr: string
  addressAr: string | null
  district: string | null
  phone: string | null
  lat: number | null
  lng: number | null
  hours: BranchHours | null
  rating: number
  reviewCount: number
  photos: string[]
  /** ACTIVE category slugs — drives the derived type badge like Home. */
  categorySlugs: string[]
  services: BranchServiceItem[]
}

export interface BranchSlotPreview {
  slotDate: string
  slotTime: string
}
