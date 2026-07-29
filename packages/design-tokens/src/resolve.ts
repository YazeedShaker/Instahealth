import { colors, shadows } from './tokens'
import type { TokenRef } from './components'

// Turns a component-contract token reference into a real value.
//
// The contract stores refs like 'primary.400' rather than hex, so ONE spec
// serves both platforms: the web resolves to a CSS custom property (so themes
// and dark mode keep working), React Native resolves to a literal (it has no
// CSS vars). A literal in the contract — '#FFFFFF', 'transparent', or one of
// the design system's AA-contrast pairings — passes through untouched.

const LITERAL_PREFIXES = ['#', 'rgb', 'hsl', 'transparent', 'currentColor']

function isLiteral(ref: TokenRef): boolean {
  return LITERAL_PREFIXES.some((prefix) => ref.startsWith(prefix))
}

/** `'primary.400'` → `'var(--ih-primary-400)'` · `'shadow.card'` → `'var(--ih-shadow-card)'` */
export function resolveTokenCss(ref: TokenRef): string {
  if (isLiteral(ref)) return ref
  const parts = ref.split('.')
  // 'semantic.errorBg' → error-bg · 'text.primary' → text-primary
  const tail = parts
    .slice(parts[0] === 'semantic' ? 1 : 0)
    .join('-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
  return `var(--ih-${tail})`
}

type ColorGroup = Record<string, string>

/** `'primary.400'` → `'#02C39A'`. Throws on an unknown ref rather than
 * silently rendering `undefined` — a missing colour must fail loudly, the way
 * a missing commission rate does (ENGINEERING-WORKFLOW §7). */
export function resolveTokenNative(ref: TokenRef): string {
  if (isLiteral(ref)) return ref

  const [group, key] = ref.split('.')
  if (group === undefined || key === undefined) {
    throw new Error(`resolveTokenNative: malformed token ref "${ref}"`)
  }

  if (group === 'shadow') {
    const value = (shadows as ColorGroup)[key]
    if (value === undefined) throw new Error(`resolveTokenNative: unknown shadow "${ref}"`)
    return value
  }

  const groups = colors as unknown as Record<string, ColorGroup>
  const found = groups[group]?.[key]
  if (found === undefined) throw new Error(`resolveTokenNative: unknown token "${ref}"`)
  return found
}
