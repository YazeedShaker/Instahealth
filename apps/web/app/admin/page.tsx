import { redirect } from 'next/navigation'

// `/admin` — the address a human actually types.
//
// ⚠ IT WAS A 404. Both `(auth)` and `(shell)` are ROUTE GROUPS, so they add no
// path segment: `/admin/login` and `/admin/overview` exist, and `/admin` itself
// had no page at all. Every deep link into the portal worked and the front door
// did not, which is the kind of gap that only shows up when someone types the
// obvious thing.
//
// ⚠ AND IT DELIBERATELY DOES NOT DECIDE WHERE TO SEND ANYONE. The shell layout
// already owns that decision across SIX states — signed out, not an admin, a
// forced password change, enrollment, unconfirmed recovery codes, and the
// TOTP step — including the stale-`aal2`-claim case that would otherwise brick
// the account. Re-deriving any of that here would be a second gate that can
// drift from the first, and a gate that disagrees with the real one is worse
// than no gate. So this hands off to /admin/overview and lets the authority
// answer.
export const dynamic = 'force-dynamic'

export default function AdminRootPage() {
  redirect('/admin/overview')
}
