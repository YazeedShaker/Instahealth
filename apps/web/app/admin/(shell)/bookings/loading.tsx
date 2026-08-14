import {
  AdminHeaderSkeleton,
  AdminMain,
  AdminTableSkeleton,
  AdminToolbarSkeleton,
} from '../../../../components/admin/AdminSkeleton'

// A06 «مراقبة الحجوزات» — six columns, the widest table in the portal.
export default function Loading() {
  return (
    <>
      <AdminHeaderSkeleton />
      <AdminMain>
        <AdminToolbarSkeleton />
        <AdminTableSkeleton rows={7} columns={[0.14, 0.22, 0.2, 0.16, 0.14, 0.14]} />
      </AdminMain>
    </>
  )
}
