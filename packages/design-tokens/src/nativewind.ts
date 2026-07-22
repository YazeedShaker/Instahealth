// NativeWind theme mapping for the mobile app.
// Same palette as web — one source of truth (tokens.ts), two consumers.
import { colors, radius, typography } from './tokens'

export const nativewindTheme = {
  colors: {
    'ih-primary': colors.primary,
    'ih-accent': colors.accent,
    'ih-neutral': colors.neutral,
    'ih-success': colors.semantic.success,
    'ih-warning': colors.semantic.warning,
    'ih-error': colors.semantic.error,
    'ih-info': colors.semantic.info,
  },
  fontFamily: {
    // Font families registered in the Expo app via expo-font (see app/_layout.tsx)
    arabic: ['Cairo_400Regular'],
    'arabic-semibold': ['Cairo_600SemiBold'],
    'arabic-bold': ['Cairo_700Bold'],
    english: ['AtkinsonHyperlegible_400Regular'],
    'english-bold': ['AtkinsonHyperlegible_700Bold'],
  } satisfies Record<string, string[]>,
  borderRadius: {
    'ih-xs': radius.xs,
    'ih-sm': radius.sm,
    'ih-md': radius.md,
    'ih-lg': radius.lg,
    'ih-xl': radius.xl,
    'ih-full': radius.full,
  },
  fontSize: { ...typography.sizes },
}
