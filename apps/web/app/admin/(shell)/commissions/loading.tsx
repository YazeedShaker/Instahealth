import {
  AdminHeaderSkeleton,
  AdminMain,
  AdminStatCardsSkeleton,
  AdminTableSkeleton,
} from '../../../../components/admin/AdminSkeleton'

// A02 «العمولات وكشوف الحساب» — the totals band over the statement lines.
export default function Loading() {
  return (
    <>
      <AdminHeaderSkeleton />
      <AdminMain>
        <AdminStatCardsSkeleton count={3} />
        <AdminTableSkeleton rows={6} columns={[0.16, 0.28, 0.2, 0.18, 0.18]} />
      </AdminMain>
    </>
  )
}
