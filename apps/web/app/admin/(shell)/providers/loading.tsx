import {
  AdminHeaderSkeleton,
  AdminMain,
  AdminTableSkeleton,
  AdminToolbarSkeleton,
} from '../../../../components/admin/AdminSkeleton'

// A03 «المزودون والفروع» — the list. The detail variant renders at the same
// route with `?provider=`, and a list skeleton is the honest placeholder for
// both: the header is identical and the panel below is a table either way.
export default function Loading() {
  return (
    <>
      <AdminHeaderSkeleton subtitle={false} />
      <AdminMain>
        <AdminToolbarSkeleton />
        <AdminTableSkeleton rows={6} columns={[0.28, 0.2, 0.18, 0.17, 0.17]} />
      </AdminMain>
    </>
  )
}
