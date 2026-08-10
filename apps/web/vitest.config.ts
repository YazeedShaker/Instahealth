import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Vitest must not load the app's Tailwind v4 PostCSS pipeline
  css: { postcss: {} },
  test: {
    // ⚠ QUIET IN CI, VERBOSE LOCALLY. `dot` still prints the SUMMARY COUNTS,
    // which is the one thing that must never be lost — a skipped suite and a
    // passing suite look identical without them (ENGINEERING-WORKFLOW §9).
    // What it drops is the per-file tick list nobody reads on a green run.
    reporters: process.env.CI ? ['dot'] : ['default'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
    passWithNoTests: true,
  },
})
