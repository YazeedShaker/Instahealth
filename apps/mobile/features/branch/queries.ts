import {
  getSlotStatus,
  parseBranchHours,
  parseFastingHours,
  type BranchServiceItem,
} from '@instahealth/core'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '../../lib/supabase'
import type { BranchProfile, BranchSlotPreview } from './types'

const CAIRO_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' })
const CAIRO_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const DAY_MS = 24 * 60 * 60 * 1000
const PREVIEW_WINDOW_DAYS = 3
const PREVIEW_CHIP_COUNT = 6

/**
 * Branch-by-id with provider + services + categories, one round trip
 * (branch join + active categories, same shapes as F02's Home query).
 * Resolves to null for unknown/inactive ids — the screen renders the
 * friendly error state, never a crash.
 */
export function useBranchProfile(branchId: string | undefined) {
  return useQuery({
    queryKey: ['branch', branchId],
    enabled: branchId !== undefined && branchId.length > 0,
    queryFn: async (): Promise<BranchProfile | null> => {
      const [branchResult, categoriesResult] = await Promise.all([
        supabase
          .from('branches')
          .select(
            `id, name_ar, address_ar, district, phone, lat, lng, operating_hours,
             rating, review_count, photos, is_active,
             provider:providers!inner(name_ar, is_active),
             branch_services(id, price, is_available,
               service:services!inner(id, name_ar, name_en, category_id, is_active,
                 preparation_notes_ar, preparation_notes_en, sort_order))`,
          )
          .eq('id', branchId as string)
          .maybeSingle(),
        supabase
          .from('service_categories')
          .select('id, slug, name_ar, name_en, icon, sort_order, is_active')
          .eq('is_active', true),
      ])
      if (branchResult.error) throw branchResult.error
      if (categoriesResult.error) throw categoriesResult.error

      const branch = branchResult.data
      if (!branch || branch.is_active === false || branch.provider.is_active === false) return null

      const activeCategoriesById = new Map(
        categoriesResult.data.map((category) => [category.id, category]),
      )

      // The SAME predicate create_pending_booking enforces (§1.4 — the screen
      // may not offer what the server will refuse):
      //   · the partner has it switched on
      //   · the partner has actually PRICED it — a NULL price is «بلا سعر», an
      //     offering the branch has never quoted, and it is unbookable
      //     (migration 20260810142758)
      //   · the admin has it published — `services.is_active` is generated from
      //     `services.status`, so draft and suspended fall out here for free
      //   · its category is launched
      const services: BranchServiceItem[] = branch.branch_services
        .filter(
          (branchService): branchService is typeof branchService & { price: number } =>
            branchService.is_available !== false &&
            branchService.price !== null &&
            branchService.service.is_active !== false &&
            activeCategoriesById.has(branchService.service.category_id),
        )
        .sort(
          (a, b) =>
            (a.service.sort_order ?? Number.MAX_SAFE_INTEGER) -
            (b.service.sort_order ?? Number.MAX_SAFE_INTEGER),
        )
        .map((branchService) => {
          const category = activeCategoriesById.get(branchService.service.category_id)
          if (!category) throw new Error('unreachable: category filtered above')
          return {
            id: branchService.service.id,
            branchServiceId: branchService.id,
            nameAr: branchService.service.name_ar,
            nameEn: branchService.service.name_en,
            priceEgp: branchService.price,
            preparationNotesAr: branchService.service.preparation_notes_ar,
            preparationNotesEn: branchService.service.preparation_notes_en,
            fastingHours: parseFastingHours(
              branchService.service.preparation_notes_ar,
              branchService.service.preparation_notes_en,
            ),
            categorySlug: category.slug,
            categoryNameAr: category.name_ar,
            categoryNameEn: category.name_en,
            categoryIcon: category.icon,
            categorySortOrder: category.sort_order,
          }
        })

      return {
        id: branch.id,
        nameAr: branch.name_ar,
        providerNameAr: branch.provider.name_ar,
        addressAr: branch.address_ar,
        district: branch.district,
        phone: branch.phone,
        lat: branch.lat,
        lng: branch.lng,
        hours: parseBranchHours(branch.operating_hours),
        rating: branch.rating ?? 0,
        reviewCount: branch.review_count ?? 0,
        photos: branch.photos ?? [],
        categorySlugs: [...new Set(services.map((service) => service.categorySlug))],
        services,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * "أقرب المواعيد" preview strip — the next few available slots for THIS branch
 * via the get_branch_slots RPC (3-day window). Availability evaluates the SAME
 * predicate the DB enforces — booked + active unexpired holds < capacity — so
 * the preview never advertises a slot the hold RPC would reject.
 */
export function useBranchSlotsPreview(branchId: string | undefined) {
  return useQuery({
    queryKey: ['branch', branchId, 'slots-preview'],
    enabled: branchId !== undefined && branchId.length > 0,
    queryFn: async (): Promise<BranchSlotPreview[]> => {
      const now = new Date()
      const today = CAIRO_DATE.format(now)
      const windowEnd = CAIRO_DATE.format(new Date(now.getTime() + PREVIEW_WINDOW_DAYS * DAY_MS))

      const { data, error } = await supabase.rpc('get_branch_slots', {
        p_branch_id: branchId as string,
        p_from: today,
        p_to: windowEnd,
      })
      if (error) throw error

      const cairoNowTime = CAIRO_TIME.format(now)
      return data
        .filter((slot) => {
          const isPastToday = slot.slot_date === today && slot.slot_time.slice(0, 5) <= cairoNowTime
          if (isPastToday) return false
          return (
            getSlotStatus({
              capacity: slot.capacity ?? Number.MAX_SAFE_INTEGER,
              bookedCount: slot.booked_count ?? 0,
              activeHoldCount: slot.active_hold_count ?? 0,
              isBlocked: slot.is_blocked ?? false,
            }) === 'available'
          )
        })
        .slice(0, PREVIEW_CHIP_COUNT)
        .map((slot) => ({ slotDate: slot.slot_date, slotTime: slot.slot_time }))
    },
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
  })
}
