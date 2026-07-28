import type {
  BookingPaymentStatus,
  BookingStatus,
  PatientBooking,
  PaymentMethod,
} from '@instahealth/core'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '../../lib/supabase'

// My Bookings (F07) reads through the `get_patient_bookings` RPC, never a
// table query. The `slots` SELECT policy is `booked_count < capacity`, so
// `bookings → slots` returns NULL for exactly the confirmed bookings this
// screen exists to show (verified against dev). The SECURITY DEFINER function
// sees the slot and filters on `auth.uid()` internally — it takes no user id,
// so there is nothing to tamper with.

export const MY_BOOKINGS_QUERY_KEY = ['bookings', 'mine'] as const

/** The RPC hands `services` back as JSON; narrow it rather than cast. */
function parseServices(value: unknown): PatientBooking['services'] {
  if (!Array.isArray(value)) return []
  const services: PatientBooking['services'] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const row = entry as Record<string, unknown>
    if (typeof row.id !== 'string') continue
    services.push({
      id: row.id,
      nameAr: typeof row.nameAr === 'string' ? row.nameAr : '',
      nameEn: typeof row.nameEn === 'string' ? row.nameEn : '',
      priceEgp: Number(row.priceEgp ?? 0),
      preparationNotesAr:
        typeof row.preparationNotesAr === 'string' ? row.preparationNotesAr : null,
      preparationNotesEn:
        typeof row.preparationNotesEn === 'string' ? row.preparationNotesEn : null,
    })
  }
  return services
}

interface PatientBookingRow {
  id: string
  booking_ref: string | null
  status: string
  payment_status: string | null
  payment_method: string | null
  total_amount: number | null
  patient_notes: string | null
  created_at: string
  cancelled_at: string | null
  slot_date: string
  slot_time: string
  branch_id: string
  branch_name_ar: string
  branch_address_ar: string | null
  branch_phone: string | null
  branch_lat: number | null
  branch_lng: number | null
  is_hospital: boolean
  services: unknown
}

function toPatientBooking(row: PatientBookingRow): PatientBooking {
  return {
    id: row.id,
    bookingRef: row.booking_ref,
    status: row.status as BookingStatus,
    paymentStatus: (row.payment_status ?? 'pending') as BookingPaymentStatus,
    method: (row.payment_method as PaymentMethod | null) ?? null,
    totalEgp: Number(row.total_amount ?? 0),
    patientNotes: row.patient_notes,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    slotDate: row.slot_date,
    slotTime: row.slot_time,
    branchId: row.branch_id,
    branchNameAr: row.branch_name_ar,
    branchAddressAr: row.branch_address_ar,
    branchPhone: row.branch_phone,
    branchLat: row.branch_lat === null ? null : Number(row.branch_lat),
    branchLng: row.branch_lng === null ? null : Number(row.branch_lng),
    isHospital: row.is_hospital,
    services: parseServices(row.services),
  }
}

/** Every booking belonging to the signed-in patient, newest slot first. The
 * upcoming/past split and per-tab ordering happen in core. */
export function useMyBookings() {
  return useQuery({
    queryKey: MY_BOOKINGS_QUERY_KEY,
    queryFn: async (): Promise<PatientBooking[]> => {
      const { data, error } = await supabase.rpc('get_patient_bookings')
      if (error) throw error
      return (data as unknown as PatientBookingRow[]).map(toPatientBooking)
    },
    // A booking's status changes on the PROVIDER's side (confirm, complete,
    // no-show), so this list goes stale without the patient doing anything —
    // refetch whenever they come back to it.
    staleTime: 15 * 1000,
    refetchOnMount: 'always',
  })
}
