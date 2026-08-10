import { redirect } from 'next/navigation'

import { ProviderPasswordChangeForm } from '../../../components/dashboard/ProviderPasswordChangeForm'
import { getProviderContext } from '../../../lib/auth/provider'

// A05 — the forced change behind a temp password.
//
// ⚠ IT IS ITS OWN ROUTE, OUTSIDE /dashboard, because the dashboard layout
// redirects here — a change form living under the gate that sends people to it
// is an infinite loop.

export const dynamic = 'force-dynamic'

export default async function ProviderChangePasswordPage() {
  const lookup = await getProviderContext()

  if (lookup.kind === 'signedOut') redirect('/login')
  if (lookup.kind === 'notProvider') redirect('/login?rejected=1')
  if (lookup.kind === 'tempPasswordExpired') redirect('/login?temp=expired')
  // Already changed — nothing to do here, and leaving the form reachable would
  // let a signed-in member reset their own password with no current-password
  // check.
  if (lookup.kind === 'ok') redirect('/dashboard/today')

  return <ProviderPasswordChangeForm />
}
