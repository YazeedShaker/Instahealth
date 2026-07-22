# supabase/ — migrations & Edge Functions

The database is LIVE on Supabase project `instahealth-dev` (`yesxxpkyelhyojkxgmcb`, Frankfurt).
**Do not recreate it.** See `CLAUDE.md` §6.

## Status: files pending sync from the live project

This folder should contain the 5 migrations, 4 Edge Functions, and `config.toml` that are
already deployed to the live project. They were not available locally when the repo was seeded,
and the connected Supabase MCP account does not have access to this project.

To populate (once you have CLI access to the project):

```
supabase login
supabase link --project-ref yesxxpkyelhyojkxgmcb
supabase db pull                 # → migrations/
supabase functions download <slug>   # for each: e.g. cleanup-holds, …
```

Until then, treat the live project as the source of truth. Regenerate types after any
migration: `supabase gen types typescript` → `packages/core/types/database.ts`.
