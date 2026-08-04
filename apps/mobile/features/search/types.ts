// Shapes returned by the `search_catalog` RPC (migration 20260804174655),
// mapped once at the query layer — never re-derived in UI.

export interface SearchServiceBranch {
  branchId: string
  /** The branch_services row id — what the branch profile preselects on. */
  branchServiceId: string
  branchNameAr: string
  lat: number | null
  lng: number | null
  priceEgp: number
}

export interface SearchServiceResult {
  serviceId: string
  nameAr: string
  nameEn: string
  categorySlug: string
  categoryIcon: string
  requiresPreparation: boolean
  branchCount: number
  /** «تبدأ من» — the cheapest active offering. */
  minPriceEgp: number
  /** Active offerings, cheapest first (server-ordered). */
  branches: SearchServiceBranch[]
}

export interface SearchResults {
  services: SearchServiceResult[]
  /** Branches whose own/provider name matched — rendered as Home's
   * ProviderCard, the exact component. */
  branchIds: string[]
}

export interface SearchCategory {
  slug: string
  nameAr: string
  icon: string
}
