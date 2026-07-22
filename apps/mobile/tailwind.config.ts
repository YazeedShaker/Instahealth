import type { Config } from 'tailwindcss'

import { nativewindTheme } from '@instahealth/design-tokens/nativewind'
// @ts-expect-error — nativewind/preset ships a non-module .d.ts
import nativewindPreset from 'nativewind/preset'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [nativewindPreset],
  theme: {
    extend: {
      colors: nativewindTheme.colors,
      fontFamily: nativewindTheme.fontFamily,
      borderRadius: nativewindTheme.borderRadius,
    },
  },
  plugins: [],
}

export default config
