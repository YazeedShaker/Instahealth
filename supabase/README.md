# supabase/ — migrations & Edge Functions

The database is LIVE on Supabase project `instahealth-dev` (`yesxxpkyelhyojkxgmcb`, Frankfurt).
**Do not recreate it.** See `CLAUDE.md` §6.

## Contents (synced from the live project, 2026-07-23)

- `migrations/` — the 5 applied migrations, pulled from `supabase_migrations.schema_migrations`:
  1. `20260616164642_create_tables.sql` — 15 tables + uuid-ossp extension
  2. `20260616164655_create_indexes.sql` — 21 indexes
  3. `20260616164733_functions_and_triggers.sql` — `confirm_booking()`, `create_slot_hold()`,
     `generate_branch_slots()`, `cleanup_expired_holds()`, `cancel_booking()`, booking-ref +
     updated_at + rating triggers, RLS helper functions
  4. `20260616164757_rls_policies.sql` — RLS enabled on all 15 tables + policies
  5. `20260616164832_seed_data.sql` — 15 service categories (labs active) + 20 lab services
- `functions/` — the 4 deployed Edge Functions (all `verify_jwt = true`, service-role-gated):
  `cleanup-holds`, `send-sms` (Vonage, Arabic unicode), `booking-reminder`, `generate-slots`
- `config.toml` — project link + function config

These files mirror what is deployed. If you change the live project, re-sync this folder;
if you change these files, apply via migration / `supabase functions deploy` — never let them drift.

Regenerate types after any migration: `supabase gen types typescript` →
`packages/core/types/database.ts` (happens in CORE-01).
