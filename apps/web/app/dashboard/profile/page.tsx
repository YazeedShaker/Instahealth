import type { Metadata } from 'next'

import { BranchProfileView } from '../../../components/dashboard/BranchProfileView'
import { getProviderContext } from '../../../lib/auth/provider'
import { fetchBranchProfile, type BranchProfile } from '../../../lib/profile/branch-profile'
import { createClient } from '../../../lib/supabase/server'

export const metadata: Metadata = {
  title: 'بيانات الفرع — بوابة الشركاء',
}

// Never cache: a contact number the desk just fixed must not be served stale
// to the person who fixed it. The client still revalidates on mount — after a
// client-side navigation this payload can come from the Router Cache (§6a).
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  // The layout already redirected anyone who is not staff, so this is staff.
  const lookup = await getProviderContext()
  if (lookup.kind !== 'ok') return null
  const { context } = lookup

  const supabase = await createClient()

  let initialProfile: BranchProfile | null = null
  let loadFailed = false
  try {
    initialProfile = await fetchBranchProfile(supabase, context.branchId)
  } catch {
    loadFailed = true
  }

  return (
    <BranchProfileView
      branchId={context.branchId}
      displayName={context.displayName}
      initialProfile={initialProfile}
      initialLoadFailed={loadFailed}
    />
  )
}
