import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // ⚠ QUIET IN CI, VERBOSE LOCALLY. `dot` still prints the SUMMARY COUNTS,
    // which is the one thing that must never be lost — a skipped suite and a
    // passing suite look identical without them (ENGINEERING-WORKFLOW §9).
    // What it drops is the per-file tick list nobody reads on a green run.
    reporters: process.env.CI ? ['dot'] : ['default'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: process.env.CI ? ['text-summary'] : ['text'],
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
