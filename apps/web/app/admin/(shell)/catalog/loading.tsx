import {
  AdminHeaderSkeleton,
  AdminMain,
  AdminTableSkeleton,
  AdminToolbarSkeleton,
} from '../../../../components/admin/AdminSkeleton'

// A04 «كتالوج الخدمات» — the header carries the counts subtitle
// («١٤ خدمة · ١١ منشورة …»), so the skeleton reserves that second line.
export default function Loading() {
  return (
    <>
      <AdminHeaderSkeleton />
      <AdminMain>
        <AdminToolbarSkeleton />
        <AdminTableSkeleton rows={7} columns={[0.32, 0.18, 0.18, 0.16, 0.16]} />
      </AdminMain>
    </>
  )
}
