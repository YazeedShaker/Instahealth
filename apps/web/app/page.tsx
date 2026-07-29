import { redirect } from 'next/navigation'

import { getProviderContext } from '../lib/auth/provider'

// The root is a signpost, not a page.
//
// It used to be SETUP-01's scaffold proof — an Arabic heading, a cream block
// and a line printing `CURRENCY` and a resolved token — which existed to show
// that fonts, RTL, `packages/core` and the token pipeline all worked on web.
// Every one of those is now proven by a real screen the founder uses daily, so
// keeping it meant `partners.instahealth.eg` greeted staff with a demo page.
//
// Routing matches what the dashboard already enforces, so there is ONE answer
// to "who are you?" across this app:
//   provider staff        → the Today view
//   signed in, not staff  → back to the portal, rejected (same as /dashboard)
//   signed out            → the portal
//
// `getProviderContext()` is the same server-side lookup the dashboard layout
// uses — the branch is never derived from a URL, and a patient session cannot
// talk its way in here any more than it can at /dashboard.
export const dynamic = 'force-dynamic'

export default async function RootPage() {
  const lookup = await getProviderContext()

  if (lookup.kind === 'ok') redirect('/dashboard/today')
  if (lookup.kind === 'notProvider') redirect('/login?rejected=1')
  redirect('/login')
}
