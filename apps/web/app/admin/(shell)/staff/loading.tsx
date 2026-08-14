import {
  AdminHeaderSkeleton,
  AdminMain,
  AdminTableSkeleton,
  AdminToolbarSkeleton,
} from '../../../../components/admin/AdminSkeleton'

// A05 «حسابات المزودين».
export default function Loading() {
  return (
    <>
      <AdminHeaderSkeleton />
      <AdminMain>
        <AdminToolbarSkeleton />
        <AdminTableSkeleton rows={6} columns={[0.26, 0.26, 0.22, 0.13, 0.13]} />
      </AdminMain>
    </>
  )
}
