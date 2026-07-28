import { redirect } from 'next/navigation'

import { getProviderContext } from '../../lib/auth/provider'
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
    <div dir="rtl" className="flex h-screen overflow-hidden bg-ih-neutral-100">
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
