import { defineConfig } from 'vitest/config'

// Unit tests cover the PURE auth modules (errors, lockout, resend, routing) —
// no React Native imports there, so plain node environment works.
export default defineConfig({
  test: {
    include: ['features/**/*.test.ts', 'lib/**/*.test.ts', 'components/**/*.test.ts'],
  },
})
