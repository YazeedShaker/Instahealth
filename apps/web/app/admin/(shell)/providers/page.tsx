import { AdminHeader } from '../../../../components/admin/AdminHeader'
import { NetworkView } from '../../../../components/admin/NetworkView'
import { fetchProviderDetail, fetchProviderList } from '../../../../lib/network/providers'
import { createClient } from '../../../../lib/supabase/server'

// A03 — «المزودون والفروع».
//
// One route, two views: the list, and a provider's detail at `?provider=<id>`.
// Same linkable-scope pattern as the commission statement — the founder can
// send «this provider» to Mohamed and it opens the same page.
//
// force-dynamic stops SERVER caching; the client also revalidates after every
// mutation, because in a production build Next serves in-app navigation from
// the CLIENT Router Cache and `dynamic` does not touch that (§9).
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ provider?: string }>
}

export default async function AdminProvidersPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()

  const providers = await fetchProviderList(supabase)
  // Validated against the real list rather than trusted — a hand-edited query
  // string cannot ask for a provider that does not exist.
  const wanted = providers.find((p) => p.id === params.provider)?.id ?? null
  const detail = wanted === null ? null : await fetchProviderDetail(supabase, wanted)

  return (
    <>
      <AdminHeader title="المزودون والفروع" displayName="مؤسِّس" />
      <NetworkView providers={providers} detail={detail} />
    </>
  )
}
