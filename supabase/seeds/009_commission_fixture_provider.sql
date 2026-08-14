-- ============================================================
-- Seed 009: a FIXTURE PROVIDER whose commission statement can be issued.
--
-- ⚠⚠ THE RULE THIS FILE EXISTS TO ENFORCE:
--
--     MONEY ARTIFACTS FOR REAL PARTNERS ARE PRODUCED ONLY FROM SIGNED RATES.
--     FIXTURES CARRY THE TEST BURDEN.
--
-- The print stylesheet's ISSUED branch — the issue stamp, the version line and
-- the excluded-bookings footnote — was asserted by `print-statement.spec.ts`
-- and had NEVER ONCE RUN, because dev held zero issued statements and the only
-- two providers are Town Hospital and Saridar Labs. Issuing a statement for
-- either would have minted a versioned, timestamped commission document
-- against the PLACEHOLDER 12% rate that nobody has signed — a money artifact
-- with a real partner's name on it, produced to make a test go green.
--
-- That was refused, and refusing it was correct. This seed is the alternative:
-- a provider that exists ONLY to be invoiced in dev, so the assertion is
-- exercised against a document whose numbers belong to no one.
--
-- ⚠ THE `eeee…` UUID FAMILY MEANS "FIXTURE". `aaaa…` is a real launch partner
-- (seed 002), `dddd…` is a fidelity fixture (seed 008). Anything `eeee…` is
-- disposable and must never be read as a fact about the business.
--
-- ── WHY IT IS SAFE FOR A PATIENT ───────────────────────────────────────────
--
-- The provider is `is_active = TRUE` and its branch is `is_active = FALSE`, and
-- that asymmetry is deliberate, not an oversight:
--
--   · `fetchStatementProviders` (the commissions screen) filters on
--     PROVIDER.is_active, so the fixture is selectable by the founder.
--   · Every patient-facing consumer — search, discovery, the branch profile —
--     filters on BRANCH.is_active, so the fixture branch is unreachable and
--     unbookable. It has no services and no prices either, so there would be
--     nothing to book even if it were visible.
--   · `compute_commission_draft` joins `branches` WITHOUT an is_active filter,
--     so the bookings still compute. Verified by issuing the statement, not
--     assumed from reading the function.
--
-- ⚠ DEV ONLY. This has no business in production. It creates bookings that
-- were never booked and a partner that does not exist.
--
-- ── WHAT IT SEEDS ──────────────────────────────────────────────────────────
--
--   · 1 provider, 1 (inactive) branch, 1 fixture patient
--   · a commission rate of 10.00% — DELIBERATELY NOT 12.00, so a number
--     lifted from a fixture screenshot can never be mistaken for the real
--     placeholder rate, and a copy-paste into a partner conversation is
--     visibly wrong rather than plausibly right
--   · 4 COMPLETED cash bookings → commissionable
--   · 1 system-closed no_show    → EXCLUDED, which is the only way to make the
--     excluded-bookings footnote render at all
--
-- Run it (bash):
--
--   psql "$DATABASE_URL" -f supabase/seeds/009_commission_fixture_provider.sql
--
-- IDEMPOTENT: fixed UUIDs + upserts that RESET the mutable columns rather than
-- trusting what a previous run left behind. `provider_commission_rates` is
-- append-only (a trigger forbids UPDATE/DELETE), so its insert is
-- ON CONFLICT DO NOTHING — re-running must not attempt to rewrite a rate.
--
-- ⚠ THE MONTH IS FIXED, NOT RELATIVE. `issue_statement` refuses to re-issue an
-- unchanged month (`no_changes_since_last_issue`), so a seed whose bookings
-- drifted forward every run would produce a new version on every run and the
-- version line would never be reproducible.
-- ============================================================

-- ── the fixture patient ────────────────────────────────────────────────────
INSERT INTO public.users (id, phone, name_ar, name_en, preferred_language, sms_reminders)
VALUES (
  'eeee0000-0000-4000-8000-0000000000a1',
  '+201000000009',
  'مريض تجريبي (تجهيزة)',
  'Fixture patient',
  'ar',
  FALSE  -- never text anybody about a booking that did not happen
)
ON CONFLICT (id) DO UPDATE
  SET name_ar = EXCLUDED.name_ar,
      sms_reminders = FALSE;

-- ── the fixture provider ───────────────────────────────────────────────────
INSERT INTO public.providers (id, name_ar, name_en, description_ar, is_active)
VALUES (
  'eeee0000-0000-4000-8000-000000000001',
  'مزود تجريبي (تجهيزة كشوف)',
  'Statement fixture provider',
  'مزود وهمي للتحقق من طباعة كشف العمولة. لا يظهر لأي مريض ولا يمثل شريكاً حقيقياً.',
  TRUE   -- selectable on the commissions screen; see the header
)
ON CONFLICT (id) DO UPDATE
  SET name_ar = EXCLUDED.name_ar,
      description_ar = EXCLUDED.description_ar,
      is_active = TRUE;

-- ── its branch — INACTIVE, so no patient can reach it ──────────────────────
INSERT INTO public.branches (
  id, provider_id, name_ar, name_en, address_ar, governorate, district,
  lat, lng, phone, instahealth_slot_allocation, is_active
)
VALUES (
  'eeee0000-0000-4000-8000-0000000000b1',
  'eeee0000-0000-4000-8000-000000000001',
  'فرع تجريبي (تجهيزة كشوف)',
  'Statement fixture branch',
  'عنوان وهمي — لا يوجد فرع فعلي',
  'Cairo',
  'Fixture',
  30.0444, 31.2357,
  '+20200000000',
  0,      -- zero allocation: nothing to hand out even if it were visible
  FALSE   -- ⚠ THE PATIENT-SIDE LOCK. Do not flip this to TRUE.
)
ON CONFLICT (id) DO UPDATE
  SET name_ar = EXCLUDED.name_ar,
      instahealth_slot_allocation = 0,
      is_active = FALSE;

-- ── the commission rate — 10%, NOT the real placeholder 12% ────────────────
-- Append-only table: DO NOTHING, never DO UPDATE. A second run must leave the
-- signed-rate history exactly as it found it.
INSERT INTO public.provider_commission_rates (id, provider_id, percent, effective_from, note)
VALUES (
  'eeee0000-0000-4000-8000-0000000000c1',
  'eeee0000-0000-4000-8000-000000000001',
  10.00,
  DATE '2026-01-01',
  'FIXTURE RATE — not a signed agreement. Deliberately 10% so it can never be confused with the real placeholder 12%.'
)
ON CONFLICT (provider_id, effective_from) DO NOTHING;

-- ── slots for the fixture bookings ─────────────────────────────────────────
-- Fixed dates in July 2026 so the issued statement's month is stable.
INSERT INTO public.slots (id, branch_id, slot_date, slot_time, capacity, booked_count)
VALUES
  ('eeee0000-0000-4000-8000-0000000000e1', 'eeee0000-0000-4000-8000-0000000000b1', DATE '2026-07-06', TIME '09:00', 1, 1),
  ('eeee0000-0000-4000-8000-0000000000e2', 'eeee0000-0000-4000-8000-0000000000b1', DATE '2026-07-09', TIME '10:00', 1, 1),
  ('eeee0000-0000-4000-8000-0000000000e3', 'eeee0000-0000-4000-8000-0000000000b1', DATE '2026-07-15', TIME '11:30', 1, 1),
  ('eeee0000-0000-4000-8000-0000000000e4', 'eeee0000-0000-4000-8000-0000000000b1', DATE '2026-07-22', TIME '13:00', 1, 1),
  ('eeee0000-0000-4000-8000-0000000000e5', 'eeee0000-0000-4000-8000-0000000000b1', DATE '2026-07-27', TIME '15:30', 1, 1)
ON CONFLICT (id) DO UPDATE
  SET slot_date = EXCLUDED.slot_date,
      slot_time = EXCLUDED.slot_time,
      booked_count = EXCLUDED.booked_count;

-- ── the bookings ───────────────────────────────────────────────────────────
-- ⚠ FOUR COMMISSIONABLE + ONE EXCLUDED, and the shapes are not arbitrary.
-- `compute_commission_draft` counts a CASH booking when
--   status = 'completed' AND closed_by <> 'system' AND completed_at IS NOT NULL
-- and marks a row EXCLUDED when
--   status = 'no_show'   AND closed_by  = 'system'
-- The excluded one is what makes the footnote render; without it the branch
-- under test is still half unexercised.
INSERT INTO public.bookings (
  id, user_id, branch_id, slot_id, status, payment_status, payment_method,
  total_amount, confirmed_at, completed_at, no_show_at, closed_by, created_at
)
VALUES
  ('eeee0000-0000-4000-8000-0000000000f1', 'eeee0000-0000-4000-8000-0000000000a1',
   'eeee0000-0000-4000-8000-0000000000b1', 'eeee0000-0000-4000-8000-0000000000e1',
   'completed', 'paid', 'cash', 450.00,
   TIMESTAMPTZ '2026-07-05 12:00+02', TIMESTAMPTZ '2026-07-06 09:40+02', NULL, 'provider',
   TIMESTAMPTZ '2026-07-05 11:00+02'),

  ('eeee0000-0000-4000-8000-0000000000f2', 'eeee0000-0000-4000-8000-0000000000a1',
   'eeee0000-0000-4000-8000-0000000000b1', 'eeee0000-0000-4000-8000-0000000000e2',
   'completed', 'paid', 'cash', 320.00,
   TIMESTAMPTZ '2026-07-08 12:00+02', TIMESTAMPTZ '2026-07-09 10:35+02', NULL, 'provider',
   TIMESTAMPTZ '2026-07-08 11:00+02'),

  ('eeee0000-0000-4000-8000-0000000000f3', 'eeee0000-0000-4000-8000-0000000000a1',
   'eeee0000-0000-4000-8000-0000000000b1', 'eeee0000-0000-4000-8000-0000000000e3',
   'completed', 'paid', 'cash', 1250.00,
   TIMESTAMPTZ '2026-07-14 12:00+02', TIMESTAMPTZ '2026-07-15 12:05+02', NULL, 'provider',
   TIMESTAMPTZ '2026-07-14 11:00+02'),

  ('eeee0000-0000-4000-8000-0000000000f4', 'eeee0000-0000-4000-8000-0000000000a1',
   'eeee0000-0000-4000-8000-0000000000b1', 'eeee0000-0000-4000-8000-0000000000e4',
   'completed', 'paid', 'cash', 175.50,
   TIMESTAMPTZ '2026-07-21 12:00+02', TIMESTAMPTZ '2026-07-22 13:25+02', NULL, 'provider',
   TIMESTAMPTZ '2026-07-21 11:00+02'),

  -- THE EXCLUDED ONE. System-closed no-show: no commission is owed and the
  -- sheet must still print it, with its reason and a zero.
  ('eeee0000-0000-4000-8000-0000000000f5', 'eeee0000-0000-4000-8000-0000000000a1',
   'eeee0000-0000-4000-8000-0000000000b1', 'eeee0000-0000-4000-8000-0000000000e5',
   'no_show', 'pending', 'cash', 600.00,
   TIMESTAMPTZ '2026-07-26 12:00+02', NULL, TIMESTAMPTZ '2026-07-27 16:30+02', 'system',
   TIMESTAMPTZ '2026-07-26 11:00+02')
ON CONFLICT (id) DO UPDATE
  SET status = EXCLUDED.status,
      payment_status = EXCLUDED.payment_status,
      payment_method = EXCLUDED.payment_method,
      total_amount = EXCLUDED.total_amount,
      confirmed_at = EXCLUDED.confirmed_at,
      completed_at = EXCLUDED.completed_at,
      no_show_at = EXCLUDED.no_show_at,
      closed_by = EXCLUDED.closed_by;

-- ── the cash payment rows ──────────────────────────────────────────────────
-- `compute_commission_draft` reads the LATEST payment row to decide
-- cash-vs-prepaid. Cash rows are what a completed cash booking leaves behind.
INSERT INTO public.payments (id, booking_id, amount, currency, method, status, created_at)
VALUES
  ('eeee0000-0000-4000-8000-0000000000d1', 'eeee0000-0000-4000-8000-0000000000f1', 450.00, 'EGP', 'cash', 'completed', TIMESTAMPTZ '2026-07-06 09:40+02'),
  ('eeee0000-0000-4000-8000-0000000000d2', 'eeee0000-0000-4000-8000-0000000000f2', 320.00, 'EGP', 'cash', 'completed', TIMESTAMPTZ '2026-07-09 10:35+02'),
  ('eeee0000-0000-4000-8000-0000000000d3', 'eeee0000-0000-4000-8000-0000000000f3', 1250.00, 'EGP', 'cash', 'completed', TIMESTAMPTZ '2026-07-15 12:05+02'),
  ('eeee0000-0000-4000-8000-0000000000d4', 'eeee0000-0000-4000-8000-0000000000f4', 175.50, 'EGP', 'cash', 'completed', TIMESTAMPTZ '2026-07-22 13:25+02')
ON CONFLICT (id) DO UPDATE
  SET amount = EXCLUDED.amount,
      method = EXCLUDED.method,
      status = EXCLUDED.status;

-- ── proof, printed by the run ──────────────────────────────────────────────
-- Expected: 4 commissionable rows totalling 2195.50 EGP, commission at 10% =
-- 219.55 EGP, and 1 excluded row worth 600.00 EGP.
SELECT
  count(*) FILTER (WHERE status = 'completed')                     AS commissionable,
  count(*) FILTER (WHERE status = 'no_show' AND closed_by='system') AS excluded,
  sum(total_amount) FILTER (WHERE status = 'completed')            AS gmv_egp
FROM public.bookings
WHERE branch_id = 'eeee0000-0000-4000-8000-0000000000b1';
