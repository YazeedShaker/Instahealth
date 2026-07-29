// ═══════════════════════════════════════════════════════
// Component contract — the SHARED half of the design system
//
// `tokens.ts` shares VALUES (colors, type, spacing). This file shares the
// COMPONENT SPEC: what "Button, size=lg, variant=outline" actually means.
//
// Why it exists: React Native and the web cannot share component
// implementations (`<Pressable>` vs `<button>`), so each app used to re-derive
// sizing and colour by eyeballing a `.dc.html` prototype — and drifted. Mobile's
// button was 52px tall with a 6px radius; the dashboard's was 36px with an 8px
// radius; the design system says neither. Now there is ONE spec and each app
// writes a thin platform shell over it.
//
// Values are transcribed from the design-system bundle at
// `design/handoff/project/_ds/**/_ds_bundle.js` — read from source, not
// measured off a screenshot. rem values are converted to px at the 16px root
// both apps use, because React Native has no rem.
//
// ⚠ When a new design export lands, re-read the bundle and update THIS file.
// Never patch a value into an app.
// ═══════════════════════════════════════════════════════

/** A token reference (`--ih-*` CSS var on web, resolved from `colors` on RN)
 * or a literal the design system itself hardcodes. */
export type TokenRef = string

// ── Button ─────────────────────────────────────────────────────────────────

export type ButtonSize = 'sm' | 'md' | 'lg'
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'accent'

export interface ButtonSizeSpec {
  /** Vertical padding, px. */
  paddingY: number
  /** Horizontal padding, px. */
  paddingX: number
  fontSize: number
}

export interface ButtonVariantSpec {
  background: TokenRef
  color: TokenRef
  borderWidth: number
  borderColor: TokenRef | null
  fontWeight: number
  /** Background on hover — web only; RN uses `pressedOpacity`. */
  hoverBackground: TokenRef | null
}

/** `0.375rem 0.875rem` → 6/14 px, and so on. */
export const BUTTON_SIZES: Record<ButtonSize, ButtonSizeSpec> = {
  sm: { paddingY: 6, paddingX: 14, fontSize: 13 },
  md: { paddingY: 10, paddingX: 20, fontSize: 15 },
  lg: { paddingY: 14, paddingX: 28, fontSize: 16 },
}

export const BUTTON_VARIANTS: Record<ButtonVariant, ButtonVariantSpec> = {
  primary: {
    background: 'primary.400',
    color: '#FFFFFF',
    borderWidth: 0,
    borderColor: null,
    fontWeight: 600,
    hoverBackground: 'primary.500',
  },
  secondary: {
    background: 'primary.600',
    color: '#FFFFFF',
    borderWidth: 0,
    borderColor: null,
    fontWeight: 600,
    hoverBackground: 'primary.700',
  },
  outline: {
    background: 'transparent',
    color: 'text.primary',
    borderWidth: 1.5,
    borderColor: 'border.strong',
    fontWeight: 600,
    hoverBackground: null,
  },
  ghost: {
    background: 'transparent',
    color: 'primary.400',
    borderWidth: 0,
    borderColor: null,
    fontWeight: 600,
    hoverBackground: null,
  },
  destructive: {
    background: 'semantic.error',
    color: '#FFFFFF',
    borderWidth: 0,
    borderColor: null,
    fontWeight: 600,
    hoverBackground: '#B91C1C',
  },
  accent: {
    background: 'accent.300',
    color: 'primary.700',
    borderWidth: 0,
    borderColor: null,
    // The design system's one weight exception.
    fontWeight: 700,
    hoverBackground: 'accent.400',
  },
}

/** Shared across every size and variant. */
export const BUTTON_BASE = {
  borderRadius: 8,
  /** The accessible tap/click floor — 44px regardless of size (the `sm`
   * padding alone would be 26px, so this is what actually sets the height). */
  minHeight: 44,
  gap: 6,
  lineHeight: 1.4,
  disabledOpacity: 0.45,
  loadingOpacity: 0.85,
  /** Hover fallback for variants with no hoverBackground; RN press feedback. */
  hoverOpacity: 0.8,
} as const

// ── Card ───────────────────────────────────────────────────────────────────

export const CARD = {
  borderRadius: 12,
  borderWidth: 1,
  borderColor: 'border.base',
  padding: 20, // 1.25rem
  background: 'surface.base',
  raisedBackground: 'surface.raised',
  shadow: 'shadow.card',
  raisedShadow: 'shadow.raised',
  /** `topAccent` draws a 3px primary rule along the top edge. */
  topAccentWidth: 3,
  topAccentColor: 'primary.400',
} as const

// ── Alert ──────────────────────────────────────────────────────────────────

export type AlertType = 'info' | 'success' | 'warning' | 'error'

export interface AlertSpec {
  background: TokenRef
  /** The 3px rule on the INLINE START edge — RTL-safe by construction. */
  accent: TokenRef
  /** Literal in the design system: these are AA-contrast pairings, not the
   * base semantic hues. */
  text: string
  icon: string
}

export const ALERTS: Record<AlertType, AlertSpec> = {
  info: { background: 'semantic.infoBg', accent: 'semantic.info', text: '#01677A', icon: 'ℹ' },
  success: {
    background: 'semantic.successBg',
    accent: 'semantic.success',
    text: '#017A61',
    icon: '✓',
  },
  warning: {
    background: 'semantic.warningBg',
    accent: 'semantic.warning',
    text: '#92400E',
    icon: '⚠',
  },
  error: { background: 'semantic.errorBg', accent: 'semantic.error', text: '#991B1B', icon: '✕' },
}

export const ALERT_BASE = {
  borderRadius: 8,
  paddingY: 12, // 0.75rem
  paddingX: 16, // 1rem
  accentWidth: 3,
  gap: 10,
  fontSize: 14,
  lineHeight: 1.5,
} as const

// ── StatusBadge ────────────────────────────────────────────────────────────

/** The EXTENDED provider set. The design system ships four states; the
 * dashboard handoff (`Provider Dashboard - Today.dc.html`) adds `arrived`,
 * `no_show` and `pending_payment` for the desk workflow. Keys match
 * `bookings.status` exactly so nothing has to be translated. */
export type StatusBadgeKey =
  'pending' | 'pending_payment' | 'confirmed' | 'arrived' | 'completed' | 'cancelled' | 'no_show'

export interface StatusBadgeSpec {
  background: TokenRef
  color: string
  labelAr: string
  labelEn: string
}

export const STATUS_BADGES: Record<StatusBadgeKey, StatusBadgeSpec> = {
  pending: {
    background: 'semantic.warningBg',
    color: '#92600A',
    labelAr: 'قيد التأكيد',
    labelEn: 'Pending',
  },
  pending_payment: {
    background: 'semantic.warningBg',
    color: '#92600A',
    labelAr: 'بانتظار الدفع',
    labelEn: 'Awaiting payment',
  },
  // ⚠ The design system pairs `confirmed` with #028090 (cerulean) on the
  // success tint — NOT a green. Verified in both the _ds StatusBadge CFG and
  // the Today handoff's CHIPS map. Do not "correct" it to a green.
  confirmed: {
    background: 'semantic.successBg',
    color: '#028090',
    labelAr: 'مؤكد',
    labelEn: 'Confirmed',
  },
  arrived: {
    background: 'primary.50',
    color: 'primary.700',
    labelAr: 'وصل',
    labelEn: 'Arrived',
  },
  completed: {
    background: 'neutral.100',
    color: 'neutral.700',
    labelAr: 'مكتمل',
    labelEn: 'Completed',
  },
  cancelled: {
    background: 'semantic.errorBg',
    color: 'semantic.error',
    labelAr: 'ملغي',
    labelEn: 'Cancelled',
  },
  no_show: {
    background: 'neutral.100',
    color: '#991B1B',
    labelAr: 'لم يحضر',
    labelEn: 'No-show',
  },
}

export const STATUS_BADGE_BASE = {
  paddingY: 4, // 0.25rem
  paddingX: 12, // 0.75rem
  borderRadius: 9999,
  fontSize: 12, // 0.75rem
  fontWeight: 600,
  gap: 6,
} as const

// ── PreparationNote ────────────────────────────────────────────────────────

/** The design system's own `components/feedback/PreparationNote.jsx` — the
 * accent-tinted block that carries fasting/preparation instructions. Both the
 * patient app and the dashboard drawer show the SAME note to the SAME patient,
 * so it belongs in the contract rather than being drawn twice.
 *
 * `titleColor` on the primary-700 and body on primary-800 is the bundle's own
 * pairing, not a choice made here. */
export const PREPARATION_NOTE = {
  background: 'accent.200',
  borderWidth: 1,
  borderColor: 'accent.400',
  borderRadius: 8,
  paddingY: 14, // 0.875rem
  paddingX: 16, // 1rem
  titleFontSize: 12, // 0.75rem
  titleFontWeight: 700,
  titleColor: 'primary.700',
  titleLetterSpacing: '0.08em',
  titleMarginBottom: 5.6, // 0.35rem
  bodyFontSize: 14, // 0.875rem
  bodyColor: 'primary.800',
  bodyLineHeight: 1.6,
} as const

// ── Chip ───────────────────────────────────────────────────────────────────

export const CHIP_BASE = {
  paddingY: 2,
  paddingX: 8,
  borderRadius: 9999,
  fontSize: 11.2, // 0.7rem
  fontWeight: 600,
  gap: 6,
  defaultBackground: 'primary.50',
  defaultColor: 'primary.700',
} as const

// ── Input ──────────────────────────────────────────────────────────────────

export const INPUT_BASE = {
  minHeight: 48,
  paddingX: 14,
  borderRadius: 8,
  borderWidth: 1.5,
  borderColor: 'neutral.200',
  focusBorderColor: 'primary.400',
  background: 'neutral.0',
  color: 'neutral.800',
  fontSize: 15,
  labelFontSize: 13,
  labelFontWeight: 600,
  labelColor: 'neutral.700',
  gap: 7,
} as const
