import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // The spec's coverage bar applies to business logic and schemas —
      // types are erased and client factories are thin SDK wrappers.
      include: ['src/business/**', 'src/schemas/**', 'src/constants/**'],
      exclude: ['**/*.test.ts'],
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 90,
      },
    },
  },
})
