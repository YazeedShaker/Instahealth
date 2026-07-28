import type { Config } from 'tailwindcss'

import { nativewindTheme } from '@instahealth/design-tokens/nativewind'
// @ts-expect-error — nativewind/preset ships a non-module .d.ts
import nativewindPreset from 'nativewind/preset'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [nativewindPreset],
  // Class-based, not the 'media' default. On web react-native-css-interop
  // watches the document for scheme changes and throws
  // "Cannot manually set color scheme, as dark mode is type 'media'" on boot
  // when it tries to apply one. The app is light-only anyway
  // (`userInterfaceStyle: 'light'`, zero `dark:` variants), so this just tells
  // the runtime the scheme is ours to control and stops the error.
  darkMode: 'class',
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
