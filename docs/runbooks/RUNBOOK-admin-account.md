# RUNBOOK — the admin account

> Manual procedures for the InstaHealth admin panel. **There is no self-service
> anything here, by design** — the design states it («لا استعادة ذاتية — الحساب
> الوحيد يُدار يدوياً») and A01 honours it. Every procedure below needs database
> access, which means a founder, not a support agent.
>
> Applies from A01 (2026-08-08). Read `docs/specs/SPEC-A01-admin-auth-shell.md`
> for why the surface is shaped this way.

---

## 0 · What exists

| Thing                   | Where                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| The genesis admin       | `supabase/seeds/005_admin_users.sql` — `admin@instahealth.eg`                                        |
| Schema (codes, lockout) | migrations `20260808161645`, `20260808163722`, `20260808231917`                                      |
| The recovery reset      | Edge Function `admin-recovery-reset` (service role)                                                  |
| Credentials             | `ADMIN_TEST_EMAIL` / `ADMIN_TEST_PASSWORD` — password manager, `apps/web/.env.local`, GitHub secrets |

**No admin credential is ever written into this repo.** The repo is PUBLIC and
removal is not rotation (CLAUDE.md §8).

---

## 1 · Bootstrapping the admin in a NEW environment (prod)

This is the only procedure that runs in production, and it runs **once**.

1. Generate a temp password (24+ chars) and put it in the founder's password
   manager. Do not paste it into Slack, a commit message, or a PR body.
2. Export it and run the seed:

```bash
psql "$DATABASE_URL" -v admin_password="'$ADMIN_TEST_PASSWORD'" -f supabase/seeds/005_admin_users.sql
```

3. Sign in at `/admin/login`. The panel will force, in this order:
   **change the password → enrol an authenticator → save the recovery codes.**
   None of the three is skippable.
4. Store the eight recovery codes **off-device**. They are shown once and are
   bcrypt-hashed the moment they are generated — nobody can recover them later,
   including us.
5. Burn the temp password from step 1; it is dead the moment step 3 completes.

⚠ **The seed is idempotent and re-runnable, but re-running it in prod resets the
password and re-raises `must_change_password`.** That is the intended
re-bootstrap behaviour. It deliberately does **not** touch `auth.mfa_factors`,
so a re-run never destroys the founder's enrolled authenticator.

---

## 2 · Password reset (there is no email flow)

The design forbids self-service reset for the admin account, so this is manual.

```sql
-- Set a NEW temp password and force the change on next login.
UPDATE auth.users
   SET encrypted_password = crypt('<new-temp-password>', gen_salt('bf')),
       updated_at = NOW()
 WHERE email = 'admin@instahealth.eg';

UPDATE public.admin_users
   SET must_change_password = TRUE
 WHERE auth_user_id = (SELECT id FROM auth.users WHERE email = 'admin@instahealth.eg');
```

Deliver the temp password out of band. The panel forces a change at the next
sign-in, so it is single-use in practice.

⚠ **Turn on `auth_leaked_password_protection` before doing this.** It is
currently DISABLED (PROGRESS → Known risks); with it off, a weak or breached
replacement is accepted silently.

---

## 3 · Lost authenticator — the supervised TOTP reset

**The founder can do this themselves IF they still have a recovery code:**
sign in with the password, click «استخدم رمز استعادة بدلاً من ذلك», enter a
code. That consumes the code, unbinds the authenticator, kills every session,
and forces re-enrollment at the next sign-in.

⚠ **A recovery code does NOT log anyone in.** Supabase provides no sound way to
reach `aal2` without the factor — proven from Node during A01, and stated in
Supabase's own reference ("Recovery codes are not supported"). Founder ruling ②,
fallback branch.

**If the codes are gone too**, it is a database procedure:

```sql
-- Unbind every factor and kill every session for the admin.
DELETE FROM auth.mfa_factors WHERE user_id =
  (SELECT id FROM auth.users WHERE email = 'admin@instahealth.eg');
DELETE FROM auth.sessions    WHERE user_id =
  (SELECT id FROM auth.users WHERE email = 'admin@instahealth.eg');
```

The next sign-in lands on the enrollment screen automatically — the gate routes
on "no verified factor", not on "first login", so both cases behave the same.

### Two windows to know about, both bounded and both deliberate

- **Password-alone window.** Between the reset and the re-enrollment the account
  has one factor. It is bounded: the very next sign-in is forced through
  enrollment before it can reach any admin surface.
- **⚠ Stale-token window, up to 60 minutes.** Supabase access tokens are
  stateless, so "kill every session" does **not** revoke a token already issued
  — it keeps its `aal2` claim until it expires. Measured during A01: TTL is
  3600s. This is why the `/admin` gate requires a **live verified factor** and
  not merely the `aal` claim; a stale `aal2` token is routed to enrollment, not
  waved through. Nothing to do operationally — it is handled — but know it
  exists before reasoning about an incident.

---

## 4 · Regenerating recovery codes

In-app, once signed in and at `aal2`: the enrollment screen's regenerate path.
A new batch **supersedes the whole previous batch**, used or not.

If the codes were displayed but never confirmed saved (a closed tab, a reload),
the gate will keep routing to `/admin/login/enroll`, which says so plainly and
offers a fresh set. The old plaintext really is unrecoverable; there is no
procedure that brings it back.

---

## 5 · Adding or removing an admin (v1: runbook only)

**`admin_users` has NO client write path** — A01 dropped the `ALL` policy and
revoked the INSERT/UPDATE/DELETE grants. That is deliberate: with an `ALL`
policy, any admin could `INSERT` another admin straight from the browser, which
is client-reachable privilege escalation and contradicts the write-path rule
(CLAUDE.md §8).

So adding an admin is seed 005 with another row, run with service-role/psql
access. Removing one is:

```sql
-- Prefer DEACTIVATING to deleting: get_user_role() honours is_active, so this
-- takes effect immediately and leaves the audit trail intact.
UPDATE public.admin_users SET is_active = FALSE WHERE auth_user_id = '<uuid>';
```

An admin-management UI is A05's question, not v1's.

---

## 6 · Dev-only: replaying the first-login flow

⚠ **Never run this in production** — it destroys the enrolled authenticator.

```sql
DELETE FROM auth.mfa_factors            WHERE user_id     = '<admin-uuid>';
DELETE FROM auth.sessions               WHERE user_id     = '<admin-uuid>';
DELETE FROM public.admin_recovery_codes WHERE auth_user_id = '<admin-uuid>';
DELETE FROM public.admin_lockouts       WHERE auth_user_id = '<admin-uuid>';
UPDATE public.admin_users
   SET must_change_password = TRUE, recovery_codes_acknowledged = FALSE
 WHERE auth_user_id = '<admin-uuid>';
```

Then re-run seed 005 to restore the temp password. `apps/web/e2e/admin.spec.ts`
is the automated companion; it restores what it can through the UI and this SQL
covers the rest.

---

## 7 · Lockout

Five failed TOTP attempts lock the admin out for **15 minutes**, auto-clearing.
Nothing is deleted and no intervention is needed — the design promises this and
`record_admin_totp_failure()` implements it, including refusing to _extend_ a
live lock so a stranger hammering the account cannot keep the founder out.

To clear one early:

```sql
DELETE FROM public.admin_lockouts WHERE auth_user_id = '<admin-uuid>';
```

⚠ **Honest limit:** `mfa.verify` is a Supabase platform endpoint reachable with
the public anon key, so we cannot intercept every attempt. What the lock
actually protects is **access to `/admin`** — the gate refuses to serve while
`locked_until` is in the future, whatever produced the session. Supabase's own
auth rate limiting is the backstop on the endpoint itself.
