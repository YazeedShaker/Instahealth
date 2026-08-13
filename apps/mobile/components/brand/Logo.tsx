import { Image, Text, View } from 'react-native'

// The brand lockups, transcribed from `design/brand/InstaHealth Brand Assets.html`
// (components/brand/*.jsx). See `design/brand/BRAND.md` for the rules.
//
// ⚠ EVERY NUMBER HERE IS A RATIO OFF `size`, EXACTLY AS THE BUNDLE DEFINES IT —
// nothing is measured by eye. The bundle's own "Don't" list says «never rebuild
// a lockup by setting the type yourself», and the way to honour that without an
// outlined master (the bundle ships none — the wordmark is live text, there is
// not one <path> in it) is to reproduce the component's declared ratios rather
// than to eyeball a layout:
//
//   horizontal  gap mark→type  size × 0.34   ·  line gap  size × 0.05
//               «InstaHealth»  size × 0.46, Atkinson 700, tracking −0.015em
//               «انستاهيلث»     size × 0.32, Cairo 600
//   stacked     gap mark→type  size × 0.26   ·  line gap  size × 0.06
//               «InstaHealth»  size × 0.34   ·  «انستاهيلث» size × 0.22
//
// ⚠ THE LATIN WORDMARK IS ATKINSON, NEVER CAIRO. The welcome screen previously
// set «InstaHealth» in `font-arabic-bold` (Cairo) split across two colours, with
// a ♥ glyph standing in for the mark — three brand rules broken in one row.
//
// ⚠ MINIMUM SIZES, from the bundle: mark 20 · single-language 24 · bilingual 36
// · stacked 56. The Arabic secondary line must never render below 11px, which
// is what sets the bilingual floor (36 × 0.32 = 11.5).
//
// The mark is a PNG rather than an SVG because `react-native-svg` is not a
// dependency of this app, and adding one to draw a logo is not worth the
// dependency. The master is `design/brand/logo/mark-{color,white}.svg`; the PNGs
// are generated from it at 256px, well past 3× for every size used here.

const TONES = {
  color: {
    mark: require('../../assets/images/brand-mark-color.png') as number,
    word: '#044F6E',
    sub: '#5E737C',
  },
  white: {
    mark: require('../../assets/images/brand-mark-white.png') as number,
    word: '#FFFFFF',
    sub: '#BFEDEA',
  },
} as const

export type LogoTone = keyof typeof TONES

/** Mark + «InstaHealth» over «انستاهيلث» — the bilingual default (navigation,
 *  receipts, email headers). Minimum size 36. */
export function LogoHorizontal({ tone = 'color', size = 40 }: { tone?: LogoTone; size?: number }) {
  const t = TONES[tone]
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="InstaHealth"
      style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.34, direction: 'ltr' }}
    >
      <Image source={t.mark} style={{ width: size, height: size }} resizeMode="contain" />
      <View style={{ alignItems: 'flex-start', gap: size * 0.05 }}>
        <Text
          style={{
            fontFamily: 'AtkinsonHyperlegible_700Bold',
            fontSize: size * 0.46,
            letterSpacing: size * 0.46 * -0.015,
            lineHeight: size * 0.46 * 1.1,
            color: t.word,
          }}
        >
          InstaHealth
        </Text>
        <Text
          style={{
            fontFamily: 'Cairo_600SemiBold',
            fontSize: size * 0.32,
            lineHeight: size * 0.32 * 1.35,
            color: t.sub,
          }}
        >
          انستاهيلث
        </Text>
      </View>
    </View>
  )
}

/** Mark above the type, centred — onboarding welcome, splash, centred hero.
 *  Minimum size 56. */
export function LogoStacked({ tone = 'color', size = 72 }: { tone?: LogoTone; size?: number }) {
  const t = TONES[tone]
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="InstaHealth"
      style={{ alignItems: 'center', gap: size * 0.26 }}
    >
      <Image source={t.mark} style={{ width: size, height: size }} resizeMode="contain" />
      <View style={{ alignItems: 'center', gap: size * 0.06 }}>
        <Text
          style={{
            fontFamily: 'AtkinsonHyperlegible_700Bold',
            fontSize: size * 0.34,
            letterSpacing: size * 0.34 * -0.015,
            lineHeight: size * 0.34 * 1.1,
            color: t.word,
          }}
        >
          InstaHealth
        </Text>
        <Text
          style={{
            fontFamily: 'Cairo_600SemiBold',
            fontSize: size * 0.22,
            lineHeight: size * 0.22 * 1.35,
            color: t.sub,
          }}
        >
          انستاهيلث
        </Text>
      </View>
    </View>
  )
}
