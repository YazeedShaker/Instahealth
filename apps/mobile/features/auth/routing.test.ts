import { describe, expect, test } from 'vitest'

import { getAuthDestination } from './routing'

describe('getAuthDestination', () => {
  test('no session → welcome', () => {
    expect(getAuthDestination({ hasSession: false, profileName: null })).toBe('/(auth)/welcome')
    expect(getAuthDestination({ hasSession: false, profileName: 'يزيد' })).toBe('/(auth)/welcome')
  })

  test('session without a name → name entry (first-time user)', () => {
    expect(getAuthDestination({ hasSession: true, profileName: null })).toBe('/(auth)/name')
    expect(getAuthDestination({ hasSession: true, profileName: '' })).toBe('/(auth)/name')
    expect(getAuthDestination({ hasSession: true, profileName: '   ' })).toBe('/(auth)/name')
  })

  test('session with a name → home (returning user)', () => {
    expect(getAuthDestination({ hasSession: true, profileName: 'يزيد' })).toBe('/(app)/home')
  })
})
