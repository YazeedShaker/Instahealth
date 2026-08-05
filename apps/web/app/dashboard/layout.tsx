import { redirect } from 'next/navigation'

import { getProviderContext } from '../../lib/auth/provider'
import { DesktopOnlyNotice } from '../../components/dashboard/DesktopOnlyNotice'
import { SidebarNav } from '../../components/dashboard/SidebarNav'

// The ROLE gate. Middleware already answered "signed in?"; this answers "staff?"
// — it needs a provider_users lookup, which is too expensive to do on every
// request in middleware and is needed here anyway.
//
// A patient landing here is rejected at the login action already, but this is
// the backstop for a session that became non-staff after the fact (deactivated
// account, revoked branch).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const lookup = await getProviderContext()

  if (lookup.kind === 'signedOut') redirect('/login')
  if (lookup.kind === 'notProvider') redirect('/login?rejected=1')

  return (
    <>
      {/* The viewport gate (VIEW-01). Both branches are always RENDERED; CSS
          picks one, so there is no hydration mismatch and no flash. The
          children are still built either way — this is a display decision, not
          a routing one, and a desk that widens its window sees the dashboard
          immediately with no reload. */}
      <DesktopOnlyNotice />
      <div
        dir="rtl"
        data-desk-only=""
        data-print="page"
        className="flex h-screen overflow-hidden bg-ih-neutral-100"
      >
        <SidebarNav />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </>
  )
}
