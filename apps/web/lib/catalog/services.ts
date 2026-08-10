import type { BranchOfferingState, ServiceStatus } from '@instahealth/core'

import { createClient } from '../supabase/server'

// A04 — the catalog's reads.
//
// ⚠ THESE ARE ALL RPCs, unlike A03's network screen which reads plain SELECTs.
// The reason is not consistency, it is that these questions cannot be answered
// by a SELECT the admin is allowed to run: «كم فرعاً بلا سعر» counts rows that
// DO NOT EXIST, «آخر تعديل» spans two audit tables from two portals, and the
// price range must agree with the number the publish dialog promises. One
// definition per number, server-side (WORKFLOW §5a①).

export interface CatalogRow {
  serviceId: string
  nameAr: string
  nameEn: string
  code: string | null
  status: ServiceStatus
  categoryId: string
  categorySlug: string
  categoryNameAr: string
  categoryIcon: string | null
  categoryIsActive: boolean
  pricedBranchCount: number
  minPriceEgp: number | null
  maxPriceEgp: number | null
  hasPreparationNote: boolean
  updatedAt: string
}

export interface CatalogCounts {
  total: number
  published: number
  draft: number
  suspended: number
}

export interface BranchOffering {
  branchId: string
  branchNameAr: string
  district: string | null
  phone: string | null
  whatsapp: string | null
  providerNameAr: string
  priceEgp: number | null
  state: BranchOfferingState
  pricedAt: string | null
}

export interface LinkableBranch {
  branchId: string
  branchNameAr: string
  providerNameAr: string
}

export interface ServicePricing {
  branches: BranchOffering[]
  linkableBranches: LinkableBranch[]
  pricedCount: number
  unpricedCount: number
  switchedOffCount: number
  branchCount: number
  linkableCount: number
  providerCount: number
  minPriceEgp: number | null
  maxPriceEgp: number | null
  unpricedNames: string[]
}

export interface CatalogAuditEntry {
  action: string
  oldValues: Record<string, unknown>
  newValues: Record<string, unknown>
  changedAt: string
  source: 'admin' | 'partner'
  who: string
}

export interface ServiceDefinition {
  serviceId: string
  nameAr: string
  nameEn: string
  code: string | null
  status: ServiceStatus
  categoryId: string
  categoryNameAr: string
  categoryIsActive: boolean
  categoryIcon: string | null
  preparationNotesAr: string | null
  preparationNotesEn: string | null
  defaultTatHours: number | null
  createdAt: string
  updatedAt: string
}

export interface ServiceDetail {
  service: ServiceDefinition
  pricing: ServicePricing
  audit: CatalogAuditEntry[]
}

export interface AdminCategory {
  categoryId: string
  slug: string
  nameAr: string
  nameEn: string
  icon: string | null
  isActive: boolean
  sortOrder: number | null
  publishedServices: number
  totalServices: number
}

export interface StatusPreview {
  found: boolean
  from: ServiceStatus
  to: ServiceStatus
  allowed: boolean
  pricing: ServicePricing
  categoryIsActive: boolean
  hasPreparationNote: boolean
  outstandingBookings: number
  weeklyBookingAverage: number
}

export interface CategoryPreview {
  found: boolean
  slug: string
  nameAr: string
  wasActive: boolean
  toActive: boolean
  publishedServices: number
  draftServices: number
  affectedBranches: number
  affectedProviders: number
  outstandingBookings: number
}

export async function fetchCatalog(): Promise<{ services: CatalogRow[]; counts: CatalogCounts }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_service_catalog')
  if (error) throw error
  return data as unknown as { services: CatalogRow[]; counts: CatalogCounts }
}

export async function fetchCategories(): Promise<AdminCategory[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_service_categories_admin')
  if (error) throw error
  return (data ?? []) as unknown as AdminCategory[]
}

/** Null for an unknown id — the screen renders its not-found state rather than
 *  crashing on a stale link. */
export async function fetchServiceDetail(serviceId: string): Promise<ServiceDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_service_detail', { p_service_id: serviceId })
  if (error) throw error
  const result = data as unknown as { found: boolean } & ServiceDetail
  return result?.found === true ? result : null
}

export async function fetchStatusPreview(
  serviceId: string,
  to: ServiceStatus,
): Promise<StatusPreview | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('preview_service_status_change', {
    p_service_id: serviceId,
    p_to_status: to,
  })
  if (error) throw error
  const result = data as unknown as StatusPreview
  return result?.found === true ? result : null
}

export async function fetchCategoryPreview(
  categoryId: string,
  toActive: boolean,
): Promise<CategoryPreview | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('preview_category_activation', {
    p_category_id: categoryId,
    p_is_active: toActive,
  })
  if (error) throw error
  const result = data as unknown as CategoryPreview
  return result?.found === true ? result : null
}
