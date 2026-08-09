import { AdminHeader } from '../../../../components/admin/AdminHeader'
import { CommissionStatementView } from '../../../../components/admin/CommissionStatementView'
import {
  buildMonthOptions,
  fetchCommissionStatement,
  fetchStatementProviders,
} from '../../../../lib/commissions/statement'
import { createClient } from '../../../../lib/supabase/server'

// A02 — «العمولات والفواتير».
//
// ⚠ force-dynamic stops SERVER caching, and that is only half the problem: in a
// PRODUCTION build Next also serves in-app navigation from the CLIENT Router
// Cache, which is how the dashboard once repainted a pre-action snapshot for a
// full ten seconds with zero refetches (ENGINEERING-WORKFLOW §9). The screen
// therefore never treats a payload as final on its own — every mutation ends in
// `router.refresh()`, and the pending state is held across that confirming read.
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ provider?: string; month?: string; version?: string }>
}

export default async function AdminCommissionsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()

  const providers = await fetchStatementProviders(supabase)
  const months = buildMonthOptions(new Date())

  if (providers.length === 0) {
    return (
      <>
        <AdminHeader title="العمولات والفواتير" displayName="مؤسِّس" />
        <main data-testid="admin-commissions" className="min-h-0 flex-1 overflow-y-auto p-6">
          <p className="text-[13px] text-ih-neutral-600">
            لا يوجد شركاء نشطون بعد — أضِف شريكاً من «المزودون والفروع» ثم عُد إلى هنا.
          </p>
        </main>
      </>
    )
  }

  // The scope comes from the URL so a statement is LINKABLE — the founder can
  // send «this exact month, this exact version» to a partner or to Mohamed and
  // it opens the same document. It is validated against the real options rather
  // than trusted, so a hand-edited query string cannot ask for a provider that
  // does not exist.
  const selectedProviderId =
    providers.find((p) => p.id === params.provider)?.id ?? (providers[0]?.id as string)
  const selectedMonth = months.includes(params.month ?? '')
    ? (params.month as string)
    : (months[0] as string)
  const parsedVersion = Number(params.version)
  const selectedVersion =
    Number.isInteger(parsedVersion) && parsedVersion > 0 ? parsedVersion : null

  const view = await fetchCommissionStatement(
    supabase,
    selectedProviderId,
    selectedMonth,
    selectedVersion,
  )

  return (
    <>
      <AdminHeader title="العمولات والفواتير" displayName="مؤسِّس" />
      <CommissionStatementView
        view={view}
        providers={providers}
        months={months}
        selectedProviderId={selectedProviderId}
        selectedMonth={selectedMonth}
        selectedVersion={selectedVersion}
      />
    </>
  )
}
