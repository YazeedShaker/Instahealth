import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Session refresh + route protection for /dashboard/*.
//
// Two jobs, in this order:
//  1. Refresh the auth cookie on every request. Without this, Server Components
//     get an expired token and the desk gets logged out mid-shift.
//  2. Bounce anyone without a session away from /dashboard.
//
// ROLE gating (patient vs provider) is deliberately NOT done here: it needs a
// provider_users lookup, and the middleware runs on every request including
// static ones. The dashboard layout does it once, server-side, where the answer
// is already needed. Middleware answers "signed in?"; the layout answers "staff?".

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Do not put anything between createServerClient and getUser(): a stray
  // await here is the documented cause of random logouts, because the cookie
  // refresh has to be the first thing that touches the response.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (pathname.startsWith('/dashboard') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Come back here after signing in.
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // The admin panel (A01). Same split of responsibilities: middleware answers
  // "signed in?", the (shell) layout answers "admin, and how far in?".
  //
  // ⚠ `/admin/login/*` is EXCLUDED — it is the sign-in flow itself, and every
  // step of it (verify, enroll, recovery, change-password) legitimately runs
  // with a session that is not yet allowed through the gate.
  const isAdminAuthRoute = pathname.startsWith('/admin/login')
  if (pathname.startsWith('/admin') && !isAdminAuthRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // ⚠ NO "already signed in → skip the login page" shortcut for /admin, unlike
  // the partner portal below. An admin session sitting on /admin/login may be
  // mid-flow — aal1 awaiting a TOTP code, or awaiting enrollment — and
  // bouncing it to /admin/overview would send it straight back here from the
  // gate. The (auth) pages each redirect a genuinely-finished session onward
  // themselves, where the four-state answer is already in hand.

  // A signed-in visitor has no business on the portal — EXCEPT when they were
  // just bounced off a staff-only surface.
  //
  // ⚠ Without the `rejected` exemption this is an infinite loop: the dashboard
  // layout sends a non-staff session to /login?rejected=1, middleware sees a
  // session on /login and sends it back to /dashboard/today, the layout rejects
  // it again. It is reachable whenever a session exists that is NOT provider
  // staff — a provider deactivated mid-session, which is exactly the case the
  // layout calls its backstop. Found while pointing the root route at the same
  // rejection path.
  const wasRejected = request.nextUrl.searchParams.get('rejected') === '1'
  if (pathname === '/login' && user && !wasRejected) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/today'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Everything except static assets and images — the session still needs
    // refreshing on public pages, or signing in on one tab leaves another stale.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
