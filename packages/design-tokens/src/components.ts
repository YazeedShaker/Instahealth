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

/** The larger BORDERED chip the Branch Details handoff introduces for card
 * headers («✎ قابلة للتعديل» / «🔒 للعرض فقط»). Transcribed from
 * `Provider Dashboard - Branch Details.dc.html` — the `_ds` Chip.jsx stays
 * borderless and small; this is a size+tone extension, not a replacement. */
export type ChipTone = 'outlinedPrimary' | 'outlinedNeutral'

export interface ChipToneSpec {
  background: TokenRef
  color: TokenRef
  borderColor: TokenRef
}

export const CHIP_MD = {
  paddingY: 5,
  paddingX: 12,
  borderRadius: 9999,
  fontSize: 12,
  fontWeight: 600,
  gap: 6,
  borderWidth: 1,
} as const

export const CHIP_TONES: Record<ChipTone, ChipToneSpec> = {
  outlinedPrimary: { background: 'primary.50', color: 'primary.700', borderColor: 'primary.400' },
  outlinedNeutral: { background: 'neutral.50', color: 'neutral.600', borderColor: 'neutral.200' },
}

// ── Toast ──────────────────────────────────────────────────────────────────

/** Transient confirmation, BOTTOM-center over the content area. Styling
 * transcribed from the Branch Details handoff (`تم حفظ بيانات الفرع — ظهرت
 * للمرضى الآن`) — no Toast exists in the `_ds` bundle, so that handoff IS the
 * spec's source. ⚠ PLACEMENT deviates from the handoff on purpose: the mockup
 * draws it top-center, the founder chose bottom (2026-08-04) — §1.5, founder
 * wins and the bundle is flagged for revision. Success auto-dismisses
 * (PRODUCT §6); the icon disc carries the ✓. */
export const TOAST = {
  /** Distance from the BOTTOM edge of the containing area. */
  offsetBottom: 24,
  background: 'neutral.800',
  color: '#FFFFFF',
  borderRadius: 12,
  paddingY: 12,
  paddingX: 18,
  fontSize: 13.5,
  fontWeight: 600,
  gap: 10,
  iconSize: 22,
  iconBackground: 'primary.400',
  /** Literal in the handoff — a deep tinted drop, not a token. */
  shadow: '0 12px 32px rgba(2,20,27,0.28)',
  /** Slide-in duration; respect prefers-reduced-motion. */
  animationMs: 350,
  autoDismissMs: 4000,
} as const

// ── BranchStatusBadge ──────────────────────────────────────────────────────

/** Branch operational state for the dashboard's locked profile card. The
 * handoff draws only `active` («● نشط», success tint on cerulean — the same
 * deliberate non-green pairing as `confirmed` above); `holiday` and `inactive`
 * follow the established warning/neutral pairings. Uses STATUS_BADGE_BASE
 * metrics. */
export type BranchStatusKey = 'active' | 'holiday' | 'inactive'

export const BRANCH_STATUS_BADGES: Record<BranchStatusKey, StatusBadgeSpec> = {
  active: {
    background: 'semantic.successBg',
    color: '#028090',
    labelAr: 'نشط',
    labelEn: 'Active',
  },
  holiday: {
    background: 'semantic.warningBg',
    color: '#92600A',
    labelAr: 'في إجازة',
    labelEn: 'On holiday',
  },
  inactive: {
    background: 'neutral.100',
    color: '#991B1B',
    labelAr: 'موقوف',
    labelEn: 'Suspended',
  },
}

// ── Card sections ──────────────────────────────────────────────────────────

/** Header/footer bands for sectioned cards (Branch Details editable + locked
 * cards; the P02 drawer draws the same anatomy). Divider uses the card border
 * color; the footer sits on the neutral-50 band. */
export const CARD_SECTIONS = {
  headerPaddingY: 16,
  headerPaddingX: 20,
  bodyPaddingY: 18,
  bodyPaddingX: 20,
  footerPaddingY: 14,
  footerPaddingX: 20,
  dividerColor: 'border.base',
  footerBackground: 'neutral.50',
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

/** The static prefix box beside an input (the Branch Details «🇪🇬 +20» country
 * box). Height/border/radius track INPUT_BASE so the pair always aligns —
 * the handoff hand-draws 44px inputs, but the system Input is 48 and the
 * CONTRACT wins over a prototype rendering (CLAUDE.md §3a). */
export const INPUT_AFFIX = {
  paddingX: 12,
  fontSize: 13.5,
  fontWeight: 700,
  color: 'neutral.700',
  background: 'neutral.50',
  gap: 6,
} as const

/** Helper + error text under a field (Branch Details handoff). Error pairs
 * the AA `#991B1B` from the Alert spec with a leading ⚠, never color alone. */
export const INPUT_HELP = {
  fontSize: 12,
  color: 'neutral.600',
  errorColor: '#991B1B',
  errorFontWeight: 600,
  gap: 7,
} as const

/** Error state on the field itself. */
export const INPUT_ERROR = {
  borderColor: 'semantic.error',
  background: 'semantic.errorBg',
} as const

// ── Admin panel (A01 · DESIGN-03) ──────────────────────────────────────────

/** ⚠ THE ADMIN ACCENT. The whole point of DESIGN-03's visual brief is that
 * nobody ever confuses which portal they are in, so الإدارة gets a DEEP-INK
 * anchor where بوابة الشركاء uses the cerulean sidebar. `#023449` is a literal
 * in every admin screen of the handoff (`Admin - *.dc.html`) and has no token
 * in `_ds` — it is introduced HERE so no page ever hardcodes it, which is the
 * §9 corollary: extend the contract, never the page. */
export const ADMIN_ACCENT = {
  /** Sidebar, brand pill, avatar disc, and the login page's authority panel. */
  ink: '#023449',
  onInk: '#FFFFFF',
  /** The login screen's right-hand panel. */
  panelWidth: 460,
  panelPaddingY: 48,
  panelPaddingX: 44,
} as const

/** «لوحة الإدارة» — the pill that names the portal in the header and beside the
 * logo on the login screen. Deliberately NOT a CHIP_TONES variant: it is
 * inverted (ink background, white text) and tracks its letters. */
export const ADMIN_PILL = {
  paddingY: 4,
  paddingX: 11,
  borderRadius: 9999,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.08,
  background: ADMIN_ACCENT.ink,
  color: ADMIN_ACCENT.onInk,
} as const

/** «قريباً» — the coming-soon chip on a placeholder surface's header. Neutral
 * and quiet on purpose: a placeholder must not read as a warning. */
export const ADMIN_SOON_CHIP = {
  paddingY: 3,
  paddingX: 10,
  borderRadius: 9999,
  fontSize: 11.5,
  fontWeight: 700,
  color: 'neutral.600',
  background: 'neutral.100',
  borderColor: 'neutral.200',
  borderWidth: 1,
} as const

/** The six TOTP digit boxes. Three states, all drawn in
 * `Admin - Login and TOTP.dc.html`: empty, active (the cell awaiting input),
 * and errored (the whole row tints when a code is refused).
 * ⚠ `width` is NOT fixed for the login rows — the handoff uses `flex: 1` with
 * `min-width: 0`, which is the VIEW-01 lesson applied at birth: a hardcoded
 * pixel width measured on one machine clips on another. The 52px below is the
 * ENROLLMENT card's row only, where the container is a fixed-width panel. */
export type CodeCellState = 'empty' | 'active' | 'filled' | 'errored'

export interface CodeCellSpec {
  borderColor: TokenRef
  background: TokenRef
}

export const CODE_CELL = {
  height: 60,
  /** Enrollment card only — the login rows flex. */
  enrollHeight: 56,
  enrollWidth: 52,
  gap: 8,
  borderRadius: 8,
  borderWidth: 1.5,
  fontSize: 24,
  enrollFontSize: 22,
  fontWeight: 700,
  color: 'neutral.800',
} as const

export const CODE_CELL_STATES: Record<CodeCellState, CodeCellSpec> = {
  empty: { borderColor: 'neutral.200', background: 'neutral.0' },
  active: { borderColor: 'primary.400', background: 'primary.50' },
  filled: { borderColor: 'primary.400', background: 'neutral.0' },
  errored: { borderColor: 'semantic.error', background: 'semantic.errorBg' },
}

/** The 30-second validity bar under the TOTP row. The design shows «صلاحية
 * الرمز الحالي: ١٩ ثانية» beside a track filled to 63% — the number and the
 * fill are the SAME fact, so a component owns both. */
export const TOTP_VALIDITY_BAR = {
  height: 4,
  borderRadius: 9999,
  track: 'neutral.100',
  fill: 'primary.400',
  labelFontSize: 12,
  labelColor: 'neutral.500',
  gap: 8,
  /** RFC 6238 step. The bar is a display of it, not an independent timer. */
  periodSeconds: 30,
} as const

/** One recovery code in the 4-column grid shown once at enrollment. */
export const RECOVERY_CODE_CELL = {
  paddingY: 6,
  borderRadius: 6,
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: 0.04,
  color: 'neutral.700',
  background: 'neutral.50',
  borderColor: 'neutral.200',
  borderWidth: 1,
  columns: 4,
  gap: 8,
} as const

// ── A02 · the commission statement ──────────────────────────────────────────
// Transcribed from `Admin - Commission Statement.dc.html` (frames A–E). These
// live in the CONTRACT rather than on the page, per ENGINEERING-WORKFLOW §9:
// a one-off style on a page is invisible to the next screen and drifts exactly
// like a hand-copied value. A06's oversight drawer reuses these.

export type StatementStatus = 'draft' | 'issued' | 'sent' | 'settled' | 'superseded'

export interface StatementChipSpec {
  label: string
  /** The leading glyph the frames use — «●» draft, «✓» sent, «✓✓» settled. */
  glyph: string
  color: TokenRef
  background: TokenRef
  borderColor: TokenRef
}

/** The status chip in the scope bar. Five states because a SUPERSEDED version
 *  stays viewable and must announce itself as «نسخة ملغاة» rather than looking
 *  like a live document. */
export const STATEMENT_STATUS_CHIP: Record<StatementStatus, StatementChipSpec> = {
  draft: {
    label: 'مسودة',
    glyph: '●',
    color: 'neutral.700',
    background: 'neutral.100',
    borderColor: 'neutral.300',
  },
  // ⚠ «مسودة», not «صدرت» — and the frames are why. Frame D shows a
  // freshly RE-ISSUED v2 carrying «● مسودة» beside an «أُصدرت في» stamp, so in
  // the founder's language مسودة means NOT YET SENT, not "not yet issued".
  // A statement that has been snapshotted but not handed to the partner is
  // still a draft to them. Same chip as the never-issued state, deliberately.
  issued: {
    label: 'مسودة',
    glyph: '●',
    color: 'neutral.700',
    background: 'neutral.100',
    borderColor: 'neutral.300',
  },
  sent: {
    label: 'أُرسلت',
    glyph: '✓',
    color: 'primary.700',
    background: 'info.bg',
    borderColor: 'primary.400',
  },
  settled: {
    label: 'تمت التسوية',
    glyph: '✓✓',
    color: 'neutral.0',
    background: 'primary.600',
    borderColor: 'primary.600',
  },
  superseded: {
    label: 'نسخة ملغاة',
    glyph: '',
    color: 'neutral.600',
    background: 'neutral.200',
    borderColor: 'neutral.300',
  },
} as const

export const STATEMENT_CHIP_BASE = {
  paddingY: 5,
  paddingX: 12,
  borderRadius: 9999,
  fontSize: 12,
  fontWeight: 600,
  borderWidth: 1,
  gap: 6,
} as const

export type StatementBannerTone = 'excluded' | 'changed' | 'creditForward' | 'superseded'

export interface StatementBannerSpec {
  glyph: string
  color: TokenRef
  background: TokenRef
  borderColor: TokenRef
}

/** The three strips that carry the statement's uncomfortable truths, plus the
 *  superseded-predecessor bar. Each is a DIFFERENT tone on purpose: an
 *  exclusion is routine (amber), a post-issue change is a problem (red), a
 *  post-settlement change is information (info). Same fact, different remedy. */
export const STATEMENT_BANNER: Record<StatementBannerTone, StatementBannerSpec> = {
  excluded: {
    glyph: '⚠',
    color: '#92400E',
    background: 'warning.bg',
    borderColor: 'rgba(217,119,6,0.35)',
  },
  changed: {
    glyph: '⚠',
    color: '#991B1B',
    background: 'error.bg',
    borderColor: 'rgba(220,38,38,0.35)',
  },
  creditForward: {
    glyph: 'ℹ',
    color: 'primary.800',
    background: 'info.bg',
    borderColor: 'rgba(2,128,144,0.28)',
  },
  superseded: {
    glyph: '',
    color: 'neutral.700',
    background: 'neutral.50',
    borderColor: 'neutral.300',
  },
} as const

export const STATEMENT_BANNER_BASE = {
  paddingY: 11,
  paddingX: 16,
  borderRadius: 8,
  borderWidth: 1,
  gap: 12,
  titleSize: 13,
  bodySize: 11.5,
} as const

/** The three summary cards. The commission card is the emphasis one — thicker
 *  top rule, larger figure — because it is the number the partner is paid. */
export const STATEMENT_SUMMARY_CARD = {
  paddingY: 14,
  paddingX: 18,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: 'neutral.200',
  topRuleWidth: 3,
  topRuleColor: 'primary.400',
  topRuleColorEmphasis: 'primary.600',
  labelSize: 12,
  figureSize: 26,
  figureSizeEmphasis: 30,
  suffixSize: 14,
  footnoteSize: 11.5,
  gap: 12,
  columns: 3,
} as const

/**
 * The seven statement columns.
 *
 * ⚠ NOT the handoff's `150px 96px 124px 128px 1fr 66px 116px`. VIEW-01's whole
 * lesson is that a pixel width measured on one machine clips on another, and
 * every one of these columns is nowrap Arabic or a nowrap Latin reference.
 * `auto` sizes each track to its own content on the machine doing the
 * rendering; the amount column keeps the design's `1fr` so slack lands where
 * the frames put it.
 *
 * ⚠ `1fr` is `minmax(auto, 1fr)`, which RESPECTS the automatic minimum.
 * `minmax(0, 1fr)` does not and can resolve to ZERO — that is the VIEW-01 trap,
 * and it is why this is not written that way.
 *
 * The table still gets an `overflow-x: auto` wrapper as the backstop, so
 * nothing is ever unreachable at any zoom level.
 */
export const STATEMENT_TABLE = {
  columns: 'auto auto auto auto 1fr auto auto',
  headerFontSize: 11.5,
  rowFontSize: 13,
  rowMinHeight: 46,
  subtotalMinHeight: 40,
  totalMinHeight: 54,
  paddingX: 18,
  gap: 8,
  /** Minimum before the wrapper starts scrolling instead of compressing. */
  minWidth: 860,
} as const
