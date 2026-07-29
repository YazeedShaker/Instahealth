import type { Metadata } from 'next'

import { PricesEditor } from '../../../components/dashboard/PricesEditor'
import { getProviderContext } from '../../../lib/auth/provider'
import { fetchBranchServices, type BranchServiceRow } from '../../../lib/services/branch-services'
import { createClient } from '../../../lib/supabase/server'

export const metadata: Metadata = {
  title: 'الخدمات والأسعار — بوابة الشركاء',
}

// Never cache: a price the desk just changed must not be served stale to the
// person who changed it.
export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  // The layout already redirected anyone who is not staff, so this is staff.
  const lookup = await getProviderContext()
  if (lookup.kind !== 'ok') return null
  const { context } = lookup

  const supabase = await createClient()

  let initialServices: BranchServiceRow[] = []
  let loadFailed = false
  try {
    initialServices = await fetchBranchServices(supabase, context.branchId)
  } catch {
    loadFailed = true
  }

  return (
    <PricesEditor
      branchId={context.branchId}
      branchNameAr={context.branchNameAr}
      displayName={context.displayName}
      initialServices={initialServices}
      initialLoadFailed={loadFailed}
    />
  )
}
