import { defineConfig } from 'vitest/config'

// Unit tests cover the PURE auth modules (errors, lockout, resend, routing) —
// no React Native imports there, so plain node environment works.
export default defineConfig({
  test: {
    // ⚠ QUIET IN CI, VERBOSE LOCALLY. `dot` still prints the SUMMARY COUNTS,
    // which is the one thing that must never be lost — a skipped suite and a
    // passing suite look identical without them (ENGINEERING-WORKFLOW §9).
    // What it drops is the per-file tick list nobody reads on a green run.
    reporters: process.env.CI ? ['dot'] : ['default'],
    include: ['features/**/*.test.ts', 'lib/**/*.test.ts', 'components/**/*.test.ts'],
  },
})
