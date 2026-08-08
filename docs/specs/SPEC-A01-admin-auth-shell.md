# SPEC · A01 — Admin: Auth (Password + TOTP + Recovery Codes) & Shell (Web)

> Hand this to Claude Code. Read the root docs, ENGINEERING-WORKFLOW, PROGRESS, the admin
> Login+TOTP screens in design/handoff/, and the auth/admin_users contract in the migrations.
> Verify against the live dev DB. One PR. This opens the /admin surface — foundation carries.

## Goal

The admin portal exists: founder signs in with email+password, then a TOTP code, inside the
approved two-panel login design; lands in the admin shell (sidebar per the bundle: نظرة عامة,
التحليلات, العمولات والفواتير, المزودون والفروع, كتالوج الخدمات, حسابات المزودين, الحجوزات)
with every route a styled placeholder EXCEPT auth itself. Role-gated hard: admin only.

## A · Data & auth layer

1. **admin_users:** verify the existing table/claim path — the user_role claim must resolve
   'admin' for these accounts (same trigger family as patient/provider; verify it covers
   admin, fix in a migration if not). Seed ONE founder admin (email from founder; temp
   password via env, forced change on first login per the design's enrollment flow).
2. **TOTP via Supabase MFA (native):** enroll (QR + manual key per the design), challenge +
   verify on every login. AAL enforcement: admin routes require aal2 — a session that passed
   only password (aal1) can reach ONLY the verify step, nothing else. Prove from Node: an
   aal1 admin session is refused data; a provider/patient session is refused everything
   including the login's step-2.
3. **Recovery codes — the custom part (design promises 8, shown once):** Supabase does not
   provide these. Build properly: generate 8 on enrollment, store HASHED (bcrypt-class) in
   an admin_recovery_codes table (service-role only, no client read path), display once per
   the design with the saved-off-device checkbox gating continue. Verification path = Edge
   Function (service role): validates code against hashes for that admin, consumes it
   (single-use), and — since a recovery code replaces the TOTP factor for one login — issues
   the aal2 step per Supabase's supported mechanism for MFA recovery. If the platform offers
   no sound way to elevate to aal2 via custom recovery, STOP and flag with options rather
   than shipping a lookalike that bypasses MFA. Used codes visibly consumed; "وَلِّد مجموعة
   جديدة بعد الدخول" affordance per design (regenerates all 8, invalidates old).
4. **Lockout per the design:** 5 failed TOTP attempts → 15-minute lock, auto-clearing,
   attempts-remaining copy, clock-drift hint. Enforce server-side (attempt tracking in the
   DB/Edge path — client copy mirrors it, never substitutes). No self-service password
   reset — the design states it; the build honors it (manual via DB only; document the
   runbook line).

## B · Shell

- `/admin/*` in apps/web behind the aal2 admin gate; the approved shell: sidebar (admin
  accent treatment distinguishing it from بوابة الشركاء), header with مؤسس badge + logout,
  RTL, component contract only. Placeholder pages carry each screen's real title + "قيد
  البناء" per the system's coming-soon treatment — and التحليلات renders its APPROVED stub
  page (the five questions + activation note) since that design is final, not a placeholder.
- Login page per the bundle exactly: the deep-ink brand panel with the authority copy,
  step 1 password, step 2 TOTP (6 boxes, 30s validity bar), wrong-code state, enrollment
  flow, recovery-code entry path. Session expiry mid-admin → back through both steps.

## Consistency section

- Display = enforcement: the verify screen's attempts-remaining mirrors the server counter;
  the recovery link appears only when codes exist unconsumed.
- Provider portal untouched — prove P01–P05 Playwright still green; the two portals share
  the app but never a session context confusion (an admin visiting /dashboard gets the
  provider gate's rejection, and vice versa).

## Tests

**Node:** aal enforcement matrix (aal1/aal2 × admin/provider/patient × /admin data),
recovery consume-once, lockout timing, regenerate invalidates old codes.
**Playwright:** full first-login (temp password → change → enroll → QR/manual → codes shown
→ checkbox → in), returning login (password → TOTP → in), wrong-code ×5 → locked state →
auto-clear honored, recovery-code login, logout.
**Manual (recorded):** enroll with a real authenticator app on your phone; sign in fresh;
use one recovery code; regenerate.

## What NOT to do

No other admin screens' content (A02+). No self-service resets. No SMS/email factors.
No role tiers inside admin (all admins equal in v1). Never store a plaintext recovery code
anywhere including logs.

## When done

PROGRESS ship entry + A02 hand-off (statement spec builds next; note the shell's nav/query
conventions it should reuse) + runbook: manual password reset + recovery procedure.
