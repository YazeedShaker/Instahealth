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

  if (pathname === '/login' && user) {
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
