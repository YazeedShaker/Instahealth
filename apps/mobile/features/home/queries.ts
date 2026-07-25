import { parseBranchHours } from '@instahealth/core'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '../../lib/supabase'
import type { HomeBranch } from './types'

const CAIRO_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' })
const DAY_MS = 24 * 60 * 60 * 1000
const SLOT_QUERY_LIMIT = 1000

/** Branches + provider + the ACTIVE categories each branch serves — one joined query. */
export function useHomeBranches() {
  return useQuery({
    queryKey: ['home', 'branches'],
    queryFn: async (): Promise<HomeBranch[]> => {
      const [branchesResult, categoriesResult] = await Promise.all([
        supabase
          .from('branches')
          .select(
            `id, name_ar, lat, lng, operating_hours, rating, review_count,
             provider:providers!inner(name_ar, is_active),
             branch_services(is_available, service:services!inner(category_id, is_active))`,
          )
          .eq('is_active', true)
          .eq('provider.is_active', true),
        supabase.from('service_categories').select('id, slug, is_active').eq('is_active', true),
      ])
      if (branchesResult.error) throw branchesResult.error
      if (categoriesResult.error) throw categoriesResult.error

      const activeCategorySlugById = new Map(
        categoriesResult.data.map((category) => [category.id, category.slug]),
      )

      return branchesResult.data.map((branch) => {
        const categorySlugs = [
          ...new Set(
            branch.branch_services
              .filter((bs) => bs.is_available !== false && bs.service.is_active !== false)
              .map((bs) => activeCategorySlugById.get(bs.service.category_id))
              .filter((slug): slug is string => slug !== undefined),
          ),
        ]
        return {
          id: branch.id,
          nameAr: branch.name_ar,
          providerNameAr: branch.provider.name_ar,
          lat: branch.lat,
          lng: branch.lng,
          hours: parseBranchHours(branch.operating_hours),
          rating: branch.rating ?? 0,
          reviewCount: branch.review_count ?? 0,
          categorySlugs,
        }
      })
    },
    staleTime: 5 * 60 * 1000,
  })
}

/** First-available slot per branch — ONE batched query over the visible ids, not N+1.
 * Ordered (date, time) ascending: each branch's first appearance IS its earliest slot. */
export function useFirstAvailableSlots(branchIds: string[]) {
  return useQuery({
    queryKey: ['home', 'first-slots', [...branchIds].sort()],
    enabled: branchIds.length > 0,
    queryFn: async (): Promise<Map<string, { slotDate: string; slotTime: string }>> => {
      const now = new Date()
      const today = CAIRO_DATE.format(now)
      const dayAfterTomorrow = CAIRO_DATE.format(new Date(now.getTime() + 2 * DAY_MS))

      const { data, error } = await supabase
        .from('slots')
        .select('branch_id, slot_date, slot_time')
        .in('branch_id', branchIds)
        .gte('slot_date', today)
        .lte('slot_date', dayAfterTomorrow)
        .eq('is_blocked', false)
        .order('slot_date', { ascending: true })
        .order('slot_time', { ascending: true })
        .limit(SLOT_QUERY_LIMIT)
      if (error) throw error

      const cairoNowTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Cairo',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(now)

      const firstByBranch = new Map<string, { slotDate: string; slotTime: string }>()
      for (const slot of data) {
        if (firstByBranch.has(slot.branch_id)) continue
        const isPastToday = slot.slot_date === today && slot.slot_time.slice(0, 5) <= cairoNowTime
        if (isPastToday) continue
        firstByBranch.set(slot.branch_id, { slotDate: slot.slot_date, slotTime: slot.slot_time })
      }
      return firstByBranch
    },
    staleTime: 60 * 1000,
  })
}
