# @instahealth/core

The single source of truth for all shared domain logic — DB types, Zod schemas,
Supabase client factories, business logic, and constants. Consumed as TypeScript
source by both apps (Next.js `transpilePackages`, Metro monorepo config). No build step.

**The rule:** if both apps need it, it lives here. If it renders anything or touches a
platform API, it does not. ESLint enforces zero `react` / `react-native` / `next` imports.

## Regenerating database types

`src/types/database.ts` is **generated — do not hand-edit**. After every migration
(same PR, per CLAUDE.md §6):

```
pnpm gen:types
```

(runs `supabase gen types typescript --project-id yesxxpkyelhyojkxgmcb` from the repo
root and overwrites `packages/core/src/types/database.ts`; requires `supabase login`
or a `SUPABASE_ACCESS_TOKEN`).

## Bilingual validation messages

Every Zod issue carries a stable **message key** (e.g. `phone.invalid`) as its
`message`. UIs resolve copy with `getErrorMessage(issue.message, locale)` from
`schemas/messages.ts`. One pattern, used everywhere.

## Booking-state boundary

State-changing booking operations (`confirm_booking`, `create_slot_hold`,
`cancel_booking`) are **Postgres functions called via RPC** — core wraps inputs
with schemas and interprets rows for display (`business/slots.ts`), it never
reimplements their logic. A hold that looks valid client-side can still be
rejected by `confirm_booking()`; apps must handle that error path.

## Tests

```
pnpm --filter @instahealth/core test
```

Vitest with V8 coverage; thresholds gate `business/` + `schemas/` at 95% lines.
