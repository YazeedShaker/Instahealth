import { isSearchableQuery } from '@instahealth/core'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '../../lib/supabase'
import type { SearchCategory, SearchResults, SearchServiceResult } from './types'

// The RPC returns Json; this is the ONE place its shape is trusted and mapped.
function mapResults(data: unknown): SearchResults {
  const raw = data as {
    services?: Record<string, unknown>[]
    branchIds?: string[]
  } | null
  return {
    services: (raw?.services ?? []).map((service): SearchServiceResult => ({
      serviceId: String(service.serviceId),
      nameAr: String(service.nameAr),
      nameEn: String(service.nameEn ?? ''),
      categorySlug: String(service.categorySlug),
      categoryIcon: String(service.categoryIcon ?? '🧪'),
      requiresPreparation: service.requiresPreparation === true,
      branchCount: Number(service.branchCount ?? 0),
      minPriceEgp: Number(service.minPriceEgp ?? 0),
      branches: ((service.branches as Record<string, unknown>[]) ?? []).map((branch) => ({
        branchId: String(branch.branchId),
        branchServiceId: String(branch.branchServiceId),
        branchNameAr: String(branch.branchNameAr),
        lat: branch.lat === null ? null : Number(branch.lat),
        lng: branch.lng === null ? null : Number(branch.lng),
        priceEgp: Number(branch.priceEgp ?? 0),
      })),
    })),
    branchIds: raw?.branchIds ?? [],
  }
}

/** Live catalog search. Enabled once the query is substantial (≥2 normalized
 * chars) OR a category filter is set (category-browse with an empty query).
 * The server enforces the same active-law predicates Home does. */
export function useSearchCatalog(query: string, categorySlug: string | null) {
  const searchable = isSearchableQuery(query)
  return useQuery({
    queryKey: ['search', 'catalog', query.trim(), categorySlug],
    enabled: searchable || categorySlug !== null,
    queryFn: async (): Promise<SearchResults> => {
      const { data, error } = await supabase.rpc('search_catalog', {
        p_query: query,
        ...(categorySlug !== null ? { p_category_slug: categorySlug } : {}),
      })
      if (error) throw error
      return mapResults(data)
    },
    staleTime: 60 * 1000,
  })
}

/** Active categories for the chips and the browse grid — icons from the DB,
 * so launching a category (flipping is_active) surfaces it here untouched. */
export function useActiveCategories() {
  return useQuery({
    queryKey: ['search', 'categories'],
    queryFn: async (): Promise<SearchCategory[]> => {
      const { data, error } = await supabase
        .from('service_categories')
        .select('slug, name_ar, icon, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data.map((category) => ({
        slug: category.slug,
        nameAr: category.name_ar,
        icon: category.icon ?? '🧪',
      }))
    },
    staleTime: 5 * 60 * 1000,
  })
}
