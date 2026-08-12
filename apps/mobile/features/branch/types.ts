import type { BranchHours, BranchServiceItem } from '@instahealth/core'

/** The shape the branch profile renders — mapped once from the joined query,
 * never re-derived in UI. Services are already filtered to available +
 * active + active-category. */
export interface BranchProfile {
  id: string
  nameAr: string
  providerId: string
  providerNameAr: string
  addressAr: string | null
  district: string | null
  phone: string | null
  lat: number | null
  lng: number | null
  hours: BranchHours | null
  /** ⚠ NULL means NO PUBLISHED REVIEWS — it is not 0. `branches.rating`
   *  defaults to 0.00 and goes NULL when the last published review is hidden,
   *  so collapsing it to 0 makes an unrated branch indistinguishable from one
   *  rated zero. Guard with `hasPublishedRating`, never with `rating > 0`. */
  rating: number | null
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
