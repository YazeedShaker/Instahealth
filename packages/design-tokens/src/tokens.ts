// ═══════════════════════════════════════════════════════
// InstaHealth Design Tokens — tokens.ts
// TypeScript constants that mirror tokens.css
// Use in tailwind.config.ts, styled-components, or
// anywhere you need token values in JS/TS
// ═══════════════════════════════════════════════════════

export const colors = {
  primary: {
    50: '#E5F7F4',
    100: '#BFEDEA',
    200: '#80DBDB',
    300: '#3DCEC4',
    400: '#02C39A', // Caribbean Green — PRIMARY CTA
    500: '#00A896', // Persian Green
    600: '#028090', // Cerulean
    700: '#05668D', // Dark Cerulean — deep anchor
    800: '#044F6E',
    900: '#023449',
    950: '#011D29',
  },
  accent: {
    100: '#FAFBEA',
    200: '#F5F8D2',
    300: '#F0F3BD', // Pale Yellow Cream — ACCENT
    400: '#E2E89A',
    500: '#C8CF6A',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F6F8F9',
    100: '#EEF1F3',
    200: '#E0E5E8',
    300: '#CDD4D8',
    400: '#B0BBC2',
    500: '#8597A1',
    600: '#5E737C',
    700: '#3D5059',
    800: '#22333A',
    900: '#111C21',
    950: '#070E12',
  },
  semantic: {
    success: '#02C39A',
    successBg: '#E5F7F4',
    warning: '#D97706',
    warningBg: '#FEF3C7',
    error: '#DC2626',
    errorBg: '#FEE2E2',
    info: '#028090',
    infoBg: '#E0F2F4',
  },
  status: {
    confirmed: '#02C39A',
    pending: '#D97706',
    completed: '#5E737C',
    cancelled: '#DC2626',
    noShow: '#9CA3AF',
  },
} as const

export const typography = {
  fonts: {
    arabic: "'Cairo', 'Noto Sans Arabic', sans-serif",
    english: "'Atkinson Hyperlegible', 'Helvetica Neue', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  sizes: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    md: '1.125rem', // 18px
    lg: '1.25rem', // 20px
    xl: '1.5rem', // 24px
    '2xl': '1.875rem', // 30px
    '3xl': '2.25rem', // 36px
    '4xl': '3rem', // 48px
  },
  weights: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  leading: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.65,
    loose: 1.8,
  },
} as const

export const spacing = {
  0: '0',
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
  16: '4rem', // 64px
  20: '5rem', // 80px
  24: '6rem', // 96px
} as const

export const radius = {
  none: '0',
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '0.75rem', // 12px
  lg: '1rem', // 16px
  xl: '1.5rem', // 24px
  '2xl': '2rem', // 32px
  full: '9999px',
} as const

export const shadows = {
  none: 'none',
  xs: '0 1px 2px 0 rgba(5, 102, 141, 0.06)',
  sm: '0 1px 3px 0 rgba(5, 102, 141, 0.08), 0 1px 2px -1px rgba(5, 102, 141, 0.06)',
  md: '0 4px 6px -1px rgba(5, 102, 141, 0.10), 0 2px 4px -2px rgba(5, 102, 141, 0.06)',
  lg: '0 10px 15px -3px rgba(5, 102, 141, 0.10), 0 4px 6px -4px rgba(5, 102, 141, 0.06)',
  xl: '0 20px 25px -5px rgba(5, 102, 141, 0.12), 0 8px 10px -6px rgba(5, 102, 141, 0.06)',
  '2xl': '0 25px 50px -12px rgba(5, 102, 141, 0.18)',
  glowSm: '0 0 0 3px rgba(2, 195, 154, 0.20)',
  glowMd: '0 0 0 4px rgba(2, 195, 154, 0.25)',
} as const

export const breakpoints = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

export const motion = {
  duration: {
    instant: '80ms',
    fast: '180ms',
    normal: '350ms',
    slow: '600ms',
  },
  easing: {
    smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  // For use with motion/react (framer-motion)
  springs: {
    snappy: { type: 'spring' as const, stiffness: 300, damping: 30 },
    gentle: { type: 'spring' as const, stiffness: 120, damping: 14 },
    bouncy: { type: 'spring' as const, stiffness: 400, damping: 10 },
    instant: { type: 'spring' as const, stiffness: 600, damping: 35 },
    release: { type: 'spring' as const, stiffness: 200, damping: 20 },
  },
} as const

// ── Tailwind config extension ────────────────────────── */
// Paste this into your tailwind.config.ts `theme.extend`
export const tailwindExtension = {
  colors: {
    'ih-primary': colors.primary,
    'ih-accent': colors.accent,
    'ih-neutral': colors.neutral,
  },
  fontFamily: {
    arabic: ['"Cairo"', '"Noto Sans Arabic"', 'sans-serif'],
    english: ['"Atkinson Hyperlegible"', '"Helvetica Neue"', 'sans-serif'],
    mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
  },
  borderRadius: {
    'ih-xs': radius.xs,
    'ih-sm': radius.sm,
    'ih-md': radius.md,
    'ih-lg': radius.lg,
    'ih-xl': radius.xl,
    'ih-2xl': radius['2xl'],
  },
  boxShadow: {
    'ih-card': shadows.sm,
    'ih-raised': shadows.md,
    'ih-floating': shadows.xl,
    'ih-glow': shadows.glowMd,
  },
} as const

// ── Type exports ─────────────────────────────────────── */
export type Theme = 'light' | 'dark'
export type Direction = 'rtl' | 'ltr'
export type Status = 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'no_show'
export type Surface = 'patient' | 'provider' | 'admin'
