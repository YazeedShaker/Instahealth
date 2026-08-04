# SPEC · PROF-01 — Profile Tab (Mobile, no design bundle — component contract only)

> Hand this to Claude Code. Read the root docs, ENGINEERING-WORKFLOW (incl. the no-build-by-eye
> rule — this spec IS the sanctioned exception: compose strictly from the existing component
> contract and established screen anatomies; zero novel visual patterns), PROGRESS, and the
> users-table/auth contract. Verify against the live dev DB. One PR.

## Goal

The حسابي tab becomes real: identity, support, app info, logout — and the App Store-mandatory
account deletion, done with honest data semantics. Deliberately thin; the substance is deletion.

## Screen (compose from the system — list-style settings anatomy like the dashboard's cards

adapted to mobile rows)

1. **Identity card:** name (tap → edit screen reusing the F01 name-entry anatomy; same
   RLS-scoped update path), phone read-only (E.164 displayed in the local format).
2. **Rows:** اللغة (disabled, "قريباً" — i18n placeholder) · تواصل معنا (opens WhatsApp/tel/
   email — values from core constants, founder supplies the patient-support contact; if unset,
   the row hides — empty means absent) · عن التطبيق (app version from expo-constants; terms/
   privacy rows DISABLED "قريباً" — note in PROGRESS: store submission requires a live privacy
   policy URL, that's a store-prep item, not this PR).
3. **تسجيل الخروج** — the existing logout action (incl. the hold-release behavior) relocated
   here as its proper home; confirm dialog.
4. **حذف الحساب** — destructive row, bottom, per the flow below.

## Account deletion (the substance — data semantics are the decision, ratified here)

- **Flow:** row → consequences screen (plain Arabic: bookings history removed from your view,
  upcoming bookings cancelled, number freed for re-registration; irreversible) → typed
  confirmation per the destructive pattern → server call → farewell toast → welcome screen.
- **Server-side (`delete-account` Edge Function — service role; the client cannot self-delete):**
  authenticate the caller; cancel their future confirmed/pending bookings through the REAL
  cancel path (slots released, desk sees cancellations, `cancelled_by = 'patient'`);
  **anonymize, don't destroy, the financial trail:** bookings/payments/notifications rows STAY
  (commission history, partner invoicing, the standing money law) but the users row is
  scrubbed — name → "مستخدم محذوف", phone → unique tombstone (`deleted-<uuid>` respecting
  constraints), any PII columns nulled; then delete the auth user (sessions die with it).
  Idempotent; partial-failure ordering documented (anonymize before auth-delete so a crash
  never leaves a live login pointing at scrubbed data — reason it out and state it).
- The freed phone number can register again as a FRESH user (prove it).
- Rate/abuse: no special limits MVP; deletion is auth-gated and idempotent.

## Tests

**Node-against-dev:** full deletion on a seeded user WITH a future booking and a completed
cash booking → future one cancelled + slot released + desk-visible; completed one intact and
anonymized; login with old session impossible; same number re-registers clean; double-call
idempotent.
**Maestro:** edit name persists across restart; support row opens the right intent; logout →
welcome; delete flow end-to-end → welcome; fresh signup with a static test number after its
deletion works.

## Acceptance criteria

- [ ] Composed entirely from existing components/anatomies — a reviewer can name the source
      pattern for every element (screenshot comparison N/A by design; state this in the PR)
- [ ] Deletion semantics exactly as ratified above, proven from Node
- [ ] Logout's single home is here; no orphaned logout elsewhere
- [ ] PROGRESS: store-prep note (privacy policy URL) + support-contact constant flagged if
      founder hasn't supplied it; CI green

## What NOT to do

No notification settings, no avatar/photo, no language switching (placeholder only), no
design-bundle wait — and no novel UI: if a needed pattern doesn't exist in the contract,
STOP and flag it rather than inventing.
