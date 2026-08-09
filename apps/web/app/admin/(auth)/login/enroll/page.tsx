import { redirect } from 'next/navigation'

import { AdminEnrollCard } from '../../../../../components/admin/AdminEnrollCard'
import { AdminRecoveryCodesRecovery } from '../../../../../components/admin/AdminRecoveryCodesRecovery'
import { adminBeginEnrollment } from '../../../actions'
import { getAdminContext } from '../../../../../lib/auth/admin'

export const dynamic = 'force-dynamic'

// Screen D — «فعّل الخطوة الثانية قبل الدخول». Reached on the first login AND
// after a recovery reset, which is why the gate routes on "no verified factor"
// rather than on "first login": the two are the same state and must behave the
// same way.
export default async function AdminEnrollPage() {
  const lookup = await getAdminContext()

  if (lookup.kind === 'signedOut' || lookup.kind === 'notAdmin') redirect('/admin/login')
  if (lookup.kind === 'needsPasswordChange') redirect('/admin/login/change-password')
  if (lookup.kind === 'needsTotp') redirect('/admin/login/verify')
  if (lookup.kind === 'ok') redirect('/admin/overview')

  // ⚠ ALREADY ENROLLED, codes minted but never confirmed saved. Do NOT start a
  // new enrollment here — the factor is fine; it is the one-time codes that
  // were lost (see migration 20260808231917). The plaintext is unrecoverable by
  // design, so the honest screen says so and offers a fresh set.
  if (lookup.kind === 'needsRecoveryCodes') {
    return <AdminRecoveryCodesRecovery />
  }

  // Mint the factor server-side so the QR and the manual key are in the first
  // paint — an enrollment screen that renders empty and then fills in invites a
  // reload, and a reload would mint a second factor.
  const enrollment = await adminBeginEnrollment()

  return <AdminEnrollCard enrollment={enrollment} />
}
