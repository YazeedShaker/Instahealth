import { z } from 'zod'

// Validated at import — a missing/invalid var throws with a clear message.
// Server-only secrets (SUPABASE_SERVICE_ROLE_KEY) are NOT read here; they are
// accessed only inside route handlers / server actions, never in shared code.
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message: 'NEXT_PUBLIC_SUPABASE_URL is missing or not a valid URL — check apps/web/.env.local',
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, {
    message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing — check apps/web/.env.local',
  }),
})

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => issue.message).join('\n')
  throw new Error(`[env] Web environment validation failed:\n${issues}`)
}

export const env = parsed.data
