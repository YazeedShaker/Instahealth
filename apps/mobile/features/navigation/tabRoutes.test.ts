import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// ⚠ THE NET FOR A CLASS OF BUG THAT SHIPPED, AND THAT NOTHING ELSE COULD SEE.
//
// F08 added `rate/[bookingId]` and `reviews/[branchId]` under `app/(app)/` and
// did not register either in that group's `_layout.tsx`. Expo Router registers
// EVERY route file in a Tabs group as a tab unless the layout says otherwise —
// so both shipped as extra tab buttons carrying their RAW ROUTE NAMES,
// untranslated, in a bar the design says holds exactly four destinations.
//
// It survived typecheck, lint, the web E2E and every unit test, because none of
// them render a tab bar. It was found on a device.
//
// ⚠ AND THE OBVIOUS NET DOES NOT WORK TODAY. `apps/mobile`'s `test:e2e` script
// currently prints a sentence and exits 0 — the Maestro CI job installs
// Maestro, prebuilds iOS, then runs that. So "E2E Mobile (Maestro)" has been
// GREEN while asserting nothing, and a Maestro-only guard would not have caught
// this either. The flow in `e2e/tab-bar.test.yaml` is written and correct and
// becomes real the moment SETUP-02 wires the runner; THIS test is what holds
// the line until then.
//
// It works statically because the root cause is static: the leak is a MISSING
// DECLARATION in `_layout.tsx`, not a rendering accident. Every route file must
// be either one of the four destinations or explicitly registered — and
// `href: null` is how a layout says "routable, but not a tab".

const APP_GROUP = resolve(__dirname, '../../app/(app)')
const LAYOUT = join(APP_GROUP, '_layout.tsx')

/** The tab bar, per DESIGN-01 and DECISION-navigation-safe-areas §1. */
const EXPECTED_TABS = ['home', 'search', 'bookings', 'profile'] as const

/** Every route this group can render, as Expo Router names them: a file
 *  `foo.tsx` is `foo`; a directory `foo/` with `bar.tsx` is `foo/bar` unless it
 *  carries its own `_layout.tsx`, in which case the DIRECTORY is the route. */
function routeNames(dir: string, prefix = ''): string[] {
  const names: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('_')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      // A nested layout makes the directory a single route (its own navigator).
      const nested = readdirSync(full).includes('_layout.tsx')
      if (nested) names.push(`${prefix}${entry}`)
      else names.push(...routeNames(full, `${prefix}${entry}/`))
      continue
    }
    if (!entry.endsWith('.tsx')) continue
    names.push(`${prefix}${entry.replace(/\.tsx$/, '')}`)
  }
  return names
}

describe('the (app) tab group registers every route it can render', () => {
  const layout = readFileSync(LAYOUT, 'utf8')
  const routes = routeNames(APP_GROUP)

  it('finds routes at all, so a broken walker cannot make this vacuous', () => {
    // ⚠ A test that enumerates nothing passes. If the group is ever restructured
    // and this walker stops finding files, THIS is what says so.
    expect(routes.length).toBeGreaterThanOrEqual(EXPECTED_TABS.length)
    for (const tab of EXPECTED_TABS) expect(routes).toContain(tab)
  })

  it.each(EXPECTED_TABS)('«%s» is a tab with an Arabic title', (tab) => {
    const declaration = new RegExp(`name="${tab}"[^/]*?title:\\s*'([^']+)'`, 's').exec(layout)
    expect(declaration, `${tab} must be declared with a title`).not.toBeNull()
    // The tab bar is Arabic. A raw route name leaking through is exactly the
    // bug — so the title must not simply be the route name.
    expect(declaration?.[1]).not.toBe(tab)
    expect(declaration?.[1]).toMatch(/[؀-ۿ]/)
  })

  it('every NON-tab route is explicitly hidden with href: null', () => {
    const leaked = routes
      .filter((route) => !EXPECTED_TABS.includes(route as (typeof EXPECTED_TABS)[number]))
      .filter((route) => {
        const declaration = new RegExp(
          `name="${route.replace(/[[\]]/g, '\\$&')}"[\\s\\S]{0,220}?/>`,
        ).exec(layout)
        return declaration === null || !declaration[0].includes('href: null')
      })

    expect(
      leaked,
      `these routes render as TAB BUTTONS with their raw names — add a\n` +
        `<Tabs.Screen name="…" options={{ href: null }} /> to app/(app)/_layout.tsx:\n` +
        leaked.join('\n'),
    ).toEqual([])
  })

  it('declares exactly the four destinations and no fifth tab', () => {
    const titled = Array.from(layout.matchAll(/name="([^"]+)"[^/]*?title:\s*'/gs), (m) => m[1])
    expect(titled.sort()).toEqual([...EXPECTED_TABS].sort())
  })
})
