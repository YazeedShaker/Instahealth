import { z } from 'zod'

// Only EXPO_PUBLIC_* vars exist in the mobile bundle.
// The service role key must NEVER appear here — or anywhere under apps/mobile. CI enforces this.
const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url({
    message:
      'EXPO_PUBLIC_SUPABASE_URL is missing or not a valid URL — check apps/mobile/.env.local',
  }),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, {
    message: 'EXPO_PUBLIC_SUPABASE_ANON_KEY is missing — check apps/mobile/.env.local',
  }),
})

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
})

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => issue.message).join('\n')
  throw new Error(`[env] Mobile environment validation failed:\n${issues}`)
}

export const env = parsed.data
