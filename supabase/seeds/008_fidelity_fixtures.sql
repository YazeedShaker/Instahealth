-- ============================================================
-- Seed 008: fixtures the FIDELITY CAPTURE HARNESS needs, and nothing else.
--
-- ⚠ WHY THIS EXISTS. `fidelity.spec.ts` captures the A04 catalog's PUBLISH
-- confirm. That dialog can only render for a service that is not already
-- published — and on dev every one of the 26 services is `published`, so the
-- state the design draws had no row to draw it from. §5a② in reverse: the state
-- is representable, there simply was no instance of it.
--
-- The honest options were: flip a REAL service to draft for the length of a
-- capture run (a live service disappearing from patient search to take a
-- screenshot), or seed one that was never published. This is the second.
--
-- ⚠ A DRAFT SERVICE CANNOT REACH A PATIENT, BY CONSTRUCTION — not by
-- convention. `services.is_active` is
--
--     GENERATED ALWAYS AS (status = 'published') STORED
--
-- (workflow §5a③), and every patient-facing consumer filters on `is_active`.
-- A row seeded `draft` is therefore invisible to search, discovery and the
-- branch profile without anyone having to remember to hide it, and it is linked
-- to no branch, so it has no price and nothing to book.
--
-- ⚠ DEV ONLY. It is a screenshot fixture; it has no business in production.
--
-- Run it (bash):
--
--   psql "$DATABASE_URL" -f supabase/seeds/008_fidelity_fixtures.sql
--
-- IDEMPOTENT: fixed UUID + upsert, and it RESETS `status` rather than trusting
-- whatever a previous run left — a capture run that accidentally CONFIRMED the
-- publish dialog would otherwise leave a published fixture behind, and the next
-- run would silently capture the wrong dialog.
-- ============================================================

INSERT INTO public.services (
  id, category_id, name_ar, name_en, description_ar,
  preparation_notes_ar, default_tat_hours, sort_order, status, code
)
SELECT
  'dddd0000-0000-4000-8000-0000000000f1',
  c.id,
  'تحليل فيتامين د (لقطات)',
  'Vitamin D — fidelity fixture',
  'خدمة مسودة موجودة لالتقاط شاشة «نشر الخدمة» فقط. لا تظهر لأي مريض.',
  'صيام ٨ ساعات قبل السحب.',
  24,
  9999,
  'draft',
  'FIDELITY-DRAFT-001'
FROM public.service_categories c
WHERE c.slug = 'labs'
ON CONFLICT (id) DO UPDATE
  SET status               = 'draft',
      name_ar              = EXCLUDED.name_ar,
      name_en              = EXCLUDED.name_en,
      description_ar       = EXCLUDED.description_ar,
      preparation_notes_ar = EXCLUDED.preparation_notes_ar,
      updated_at           = NOW();

-- ── The fixture's branch links ─────────────────────────────────────────────
-- ⚠ WITH PRICES ON SOME AND NOT OTHERS, ON PURPOSE. An unlinked draft made the
-- publish confirm read «نشر في ٠ فروع الآن» — honest, and useless as a
-- comparison against a frame drawn with real numbers. Worse, it exercised
-- exactly one branch of the Arabic number agreement.
--
-- So the fixture is linked to 24 branches, 20 priced and 4 not. That puts the
-- SAME dialog on both sides of the rule in one capture:
--     ٢٠ → «٢٠ فرعاً مُسعِّراً»   (11–99, accusative)
--      ٤ → «٤ فروع لن تظهر»      (3–10, plural)
-- which is the defect this PR fixed, provable in one screenshot.
--
-- ⚠ A price on a DRAFT service still reaches no patient: `services.is_active`
-- is GENERATED from `status = 'published'`, and it is `false` here.
INSERT INTO public.branch_services (branch_id, service_id, price, is_available)
SELECT b.id,
       'dddd0000-0000-4000-8000-0000000000f1',
       CASE WHEN ranked.rn <= 20 THEN 180 + (ranked.rn * 5) ELSE NULL END,
       TRUE
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name_ar) AS rn
    FROM public.branches
   WHERE is_active
) ranked
JOIN public.branches b ON b.id = ranked.id
WHERE ranked.rn <= 24
ON CONFLICT (branch_id, service_id) DO UPDATE
  SET price = EXCLUDED.price,
      is_available = TRUE,
      updated_at = NOW();
