import type { Config } from 'tailwindcss'

import { tailwindExtension } from '@instahealth/design-tokens'

// Same tokens as mobile — one palette, two consumers (loaded via @config in globals.css).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: { ...tailwindExtension },
  },
}

export default config
