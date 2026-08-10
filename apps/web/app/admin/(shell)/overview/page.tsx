import { OverviewView } from '../../../../components/admin/OverviewView'
import { fetchOpsOverview } from '../../../../lib/oversight/bookings'

// A07 — «نظرة عامة». Every number and every alert comes from ONE server call,
// so the cards and the attention panel cannot describe two different moments.

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  const overview = await fetchOpsOverview()
  return <OverviewView overview={overview} />
}
