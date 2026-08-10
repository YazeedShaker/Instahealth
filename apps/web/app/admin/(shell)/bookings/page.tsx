import { OversightView } from '../../../../components/admin/OversightView'
import {
  fetchAdminBookingDetail,
  fetchAdminBookings,
  fetchProviderOptions,
} from '../../../../lib/oversight/bookings'

// A06 — «الحجوزات». One route, list plus `?booking=<id>` for the drawer, the
// same linkable scope every other admin screen uses.
//
// ⚠ SEARCH AND FILTERS ARE SERVER-SIDE, in the URL. The network has more
// bookings than a browser should hold, and a founder on the phone to a patient
// needs to be able to paste the URL to someone else.

export const dynamic = 'force-dynamic'

type Search = { search?: string; provider?: string; status?: string; booking?: string }

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const params = await searchParams
  const search = params.search ?? ''
  const providerId = params.provider ?? ''
  const status = params.status ?? ''

  const [list, providers] = await Promise.all([
    fetchAdminBookings({
      search: search === '' ? undefined : search,
      providerId: providerId === '' ? undefined : providerId,
      status: status === '' ? undefined : status,
    }),
    fetchProviderOptions(),
  ])

  const detail =
    params.booking === undefined || params.booking === ''
      ? null
      : await fetchAdminBookingDetail(params.booking)

  return (
    <OversightView
      rows={list.bookings}
      total={list.total}
      providers={providers}
      detail={detail}
      search={search}
      providerId={providerId}
      status={status}
    />
  )
}
