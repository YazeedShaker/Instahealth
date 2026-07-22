import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Vitest must not load the app's Tailwind v4 PostCSS pipeline
  css: { postcss: {} },
  test: {
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
    passWithNoTests: true,
  },
})
