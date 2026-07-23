// The routing decision (session × profile name → destination) as a pure function.
// index.tsx and the post-verify step both use this — one decision, one place.

export type AuthDestination = '/(auth)/welcome' | '/(auth)/name' | '/(app)/home'

export interface AuthRoutingInput {
  hasSession: boolean
  /** The patient's `name_ar` (the schema has name_ar/name_en — there is no full_name column). */
  profileName: string | null
}

export function getAuthDestination(input: AuthRoutingInput): AuthDestination {
  if (!input.hasSession) return '/(auth)/welcome'
  if (input.profileName === null || input.profileName.trim().length === 0) return '/(auth)/name'
  return '/(app)/home'
}
