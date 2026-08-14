import {
  AdminHeaderSkeleton,
  AdminListPanelSkeleton,
  AdminMain,
  AdminStatCardsSkeleton,
} from '../../../../components/admin/AdminSkeleton'

// A07 «نظرة عامة» — the stat cards over the attention panel. Its single
// `fetchOpsOverview()` aggregates across every provider, so it is the slowest
// first paint in the portal and the one that most needed this.
//
// The header comes from `OverviewView`, not the page — so the skeleton has to
// draw it too, or the real header would appear to drop in from nowhere.
export default function Loading() {
  return (
    <>
      <AdminHeaderSkeleton />
      <AdminMain>
        <AdminStatCardsSkeleton count={4} />
        <AdminListPanelSkeleton rows={5} />
      </AdminMain>
    </>
  )
}
