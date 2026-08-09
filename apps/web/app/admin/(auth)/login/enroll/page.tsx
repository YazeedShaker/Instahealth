import QRCode from 'qrcode'

import { redirect } from 'next/navigation'

import { AdminEnrollFlow } from '../../../../../components/admin/AdminEnrollFlow'
import { adminBeginEnrollment } from '../../../actions'
import { getAdminContext } from '../../../../../lib/auth/admin'

export const dynamic = 'force-dynamic'

// Screen D — «فعّل الخطوة الثانية قبل الدخول». Reached on the first login AND
// after a recovery reset, which is why the gate routes on "no verified factor"
// rather than on "first login": the two are the same state and must behave the
// same way.
//
// ⚠ BOTH BRANCHES RENDER THE SAME COMPONENT, and that is load-bearing. Confirming
// enrollment is a server action, so the route revalidates and this page re-runs
// with the post-action state — enrolled, codes unacknowledged. If that made the
// page return a DIFFERENT component, React would unmount the first one and
// destroy the client state holding the eight one-time recovery codes, which
// exist nowhere else (the database keeps only bcrypt hashes). That is exactly
// what happened to the founder's first login: a QR scanned, then a screen saying
// the codes "were shown and not confirmed" — having shown them zero times.
// `AdminEnrollFlow` takes `codesPending` as a PROP so the element type never
// changes and the instance survives. See the note in that file.
export default async function AdminEnrollPage() {
  const lookup = await getAdminContext()

  if (lookup.kind === 'signedOut' || lookup.kind === 'notAdmin') redirect('/admin/login')
  if (lookup.kind === 'needsPasswordChange') redirect('/admin/login/change-password')
  if (lookup.kind === 'needsTotp') redirect('/admin/login/verify')
  if (lookup.kind === 'ok') redirect('/admin/overview')

  const codesPending = lookup.kind === 'needsRecoveryCodes'

  // ⚠ Do NOT start a new enrollment in the codes-pending case — the factor is
  // already verified and fine; it is only the codes that were lost. Minting a
  // second factor there would leave the account with two.
  const enrollment = codesPending ? null : await adminBeginEnrollment()

  // The QR is rendered to an inline SVG on the SERVER. No canvas, no client
  // library, no network request — and critically the secret never becomes an
  // <img src> that could land in a proxy log or a browser cache.
  const qrSvg =
    enrollment?.ok === true
      ? await QRCode.toString(enrollment.data.uri, {
          type: 'svg',
          margin: 0,
          errorCorrectionLevel: 'M',
          color: { dark: '#023449', light: '#FFFFFF' },
        })
      : null

  return (
    <AdminEnrollFlow
      qrSvg={qrSvg}
      factorId={enrollment?.ok === true ? enrollment.data.factorId : null}
      secret={enrollment?.ok === true ? enrollment.data.secret : null}
      codesPending={codesPending}
      enrollErrorAr={enrollment && !enrollment.ok ? enrollment.errorAr : null}
    />
  )
}
