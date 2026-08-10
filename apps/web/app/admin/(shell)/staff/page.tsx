import { StaffView } from '../../../../components/admin/StaffView'
import {
  fetchBranchOptions,
  fetchDisablePreview,
  fetchStaffAccounts,
  fetchStaffDetail,
} from '../../../../lib/staff/accounts'

// A05 — one route, two views: the list and `?account=<id>`.
//
// The disable confirm's numbers are fetched HERE, keyed by `?confirm=disable`,
// so `isLastActiveAccount` — which decides whether the escalated variant
// renders — is the server's answer rather than something the browser inferred
// from the row that was clicked (SPEC-A05: the escalation is enforced, not
// merely drawn).

export const dynamic = 'force-dynamic'

type Search = { account?: string; confirm?: string }

export default async function AdminStaffPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams
  const accountId = params.account

  const [staff, branches] = await Promise.all([fetchStaffAccounts(), fetchBranchOptions()])

  const detail = accountId === undefined ? null : await fetchStaffDetail(accountId)
  const disablePreview =
    accountId !== undefined && params.confirm === 'disable' && detail !== null
      ? await fetchDisablePreview(accountId)
      : null

  return (
    <StaffView
      accounts={staff.accounts}
      counts={staff.counts}
      branches={branches}
      detail={detail}
      disablePreview={disablePreview}
    />
  )
}
