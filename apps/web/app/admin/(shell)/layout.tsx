import { redirect } from 'next/navigation'

import { AdminSidebar } from '../../../components/admin/AdminSidebar'
import { DesktopOnlyNotice } from '../../../components/dashboard/DesktopOnlyNotice'
import { getAdminContext } from '../../../lib/auth/admin'

// THE ADMIN GATE. Middleware answered "signed in?"; this answers "how far in?"
//
// ⚠ It lives in a ROUTE GROUP — `app/admin/(shell)/` — so that `/admin/login/*`
// does NOT inherit it. A gate that wraps its own login screen is an infinite
// redirect, and putting the layout at `app/admin/layout.tsx` would do exactly
// that. The group contributes nothing to the URL: this file governs
// /admin/overview and its siblings, and nothing else.
//
// The four states and why the fourth exists are documented in lib/auth/admin.ts.
// The short version: `aal2` in a JWT is a CLAIM, and a claim outlives the
// factor it attests to by up to the 60-minute token TTL, so a stale token is
// sent to enrollment rather than waved through.
export default async function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const lookup = await getAdminContext()

  switch (lookup.kind) {
    case 'signedOut':
      redirect('/admin/login')
    // A patient's or a receptionist's session. `?rejected=1` keeps middleware
    // from bouncing them straight back here — the P01 infinite-loop lesson.
    case 'notAdmin':
      redirect('/admin/login?rejected=1')
    case 'needsPasswordChange':
      redirect('/admin/login/change-password')
    case 'needsEnrollment':
    // A batch of one-time codes was minted and never confirmed saved. Same
    // destination — the enrollment screen owns that conversation.
    case 'needsRecoveryCodes':
      redirect('/admin/login/enroll')
    case 'needsTotp':
      redirect('/admin/login/verify')
    case 'ok':
      break
  }

  return (
    <>
      {/* Same viewport gate as the partner portal (VIEW-01): both branches are
          always rendered and CSS picks one, so there is no hydration mismatch
          and no flash. The width floor is paired with `pointer: coarse` so a
          desk machine at 150% zoom is never told to find a computer. */}
      <DesktopOnlyNotice />
      <div
        dir="rtl"
        data-desk-only=""
        data-print="page"
        data-testid="admin-shell"
        className="flex h-screen overflow-hidden bg-ih-neutral-100"
      >
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </>
  )
}
