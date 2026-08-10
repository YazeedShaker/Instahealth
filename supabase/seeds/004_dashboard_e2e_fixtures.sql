-- ═══════════════════════════════════════════════════════════════════════════
-- Dashboard E2E fixtures — Town Hospital, today and tomorrow.
--
-- WHY THIS EXISTS: the dashboard E2E suite CONSUMES the data it tests. The
-- outcome-workflow test marks a booking completed, which also flips a cash
-- booking to paid; the cancel-on-behalf tests need something still cancellable.
-- After a few runs every count-guarded test skipped itself with a plausible
-- message ("no actionable booking today") — and **a skipped suite looks exactly
-- like a passing one in the summary line**. Six tests had quietly stopped
-- running before this file existed.
--
-- SIX bookings, four of them today, because the tests also consume each
-- other's fixtures WITHIN a single run: the outcome test eats the first
-- actionable booking, starving the cash-row and cancel-on-behalf tests that
-- follow. Spare cash bookings are far cheaper than making every test build its
-- own world.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠ THE SEED OWNS ITS SLOTS, NOT JUST ITS BOOKINGS (2026-08-10).
--
-- It used to place its bookings into whatever GENERATED slot still had room:
--   SELECT id FROM slots WHERE … AND booked_count < capacity ORDER BY slot_time
-- That silently stopped working. Town's day is five capacity-1 slots, and over
-- successive runs those five filled with bookings this seed does not own and
-- therefore never cleaned up. The query then found nothing, `EXIT WHEN v_slot
-- IS NULL` bailed, and the seed placed ZERO fixtures today — reporting success
-- the whole time. CI discovered it downstream as four failing tests whose
-- message blamed a missing SUPABASE_DB_URL secret that was in fact present.
--
-- So the fixtures now sit on slots this file creates, with deterministic ids in
-- the same `eeee…` family as the bookings, at OFF-GRID times (:10 and :40).
-- `generate_branch_slots` lays its grid on `open_time + i × step` — whole
-- minutes derived from the opening window — so :10/:40 cannot collide with it,
-- and the `(branch_id, slot_date, slot_time)` unique constraint is never in
-- play. Capacity for the suite is now a property of the seed rather than a
-- leftover of whatever else touched the day.
--
-- ⚠ IDEMPOTENCY NOW COVERS THE WHOLE FOOTPRINT. Every run deletes and recreates
-- its own slots AND its own bookings (and any holds on its own slots). It
-- touches nothing it does not own — no seed deletes unowned rows. Mutating real
-- bookings to make room was considered and REJECTED: those rows feed A02's
-- commission statements, and moving them would trip its changed-since-issue
-- detection on statements we had just issued. Manufactured drift, from CI.
--
-- ⚠ THE FIXTURE SLOTS ARE VISIBLE IN DEV SURFACES at those odd times — the P04
-- allocation grid will show an 08:10. Accepted: this is a dev/CI database and
-- the E2E depends on them existing.
--
-- Re-run to restore the day (it RESETS rather than appends, so running it after
-- a test run undoes what the tests did, and running it twice is a no-op):
--   psql "$DATABASE_URL" -f supabase/seeds/004_dashboard_e2e_fixtures.sql
--
-- Uses only the static test patient already in the repo — no new PII.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_branch    UUID := 'bbbb0000-0000-4000-8000-000000000001';
  v_patient   UUID;
  v_today     DATE := (now() AT TIME ZONE 'Africa/Cairo')::date;
  v_tomorrow  DATE := v_today + 1;
  -- A service with a REAL preparation note, so the row's prep chip and the
  -- drawer's expandable detail both have something to show.
  v_prep_svc  UUID;
  v_plain_svc UUID;
  v_ids       UUID[] := ARRAY[
    'eeee0000-0000-4000-8000-000000000001'::uuid,  -- today · cash
    'eeee0000-0000-4000-8000-000000000005'::uuid,  -- today · cash (spare)
    'eeee0000-0000-4000-8000-000000000006'::uuid,  -- today · cash (spare 2)
    'eeee0000-0000-4000-8000-000000000002'::uuid,  -- today · prepaid
    'eeee0000-0000-4000-8000-000000000003'::uuid,  -- tomorrow · cash + prep
    'eeee0000-0000-4000-8000-000000000004'::uuid   -- tomorrow · prepaid
  ];
  -- The slots those bookings sit on — one per booking, same ordering.
  -- OFF-GRID by construction: :10 and :40 never coincide with the generator's
  -- `open_time + i × step` lattice for this branch.
  v_slot_ids  UUID[] := ARRAY[
    'eeee1111-0000-4000-8000-000000000001'::uuid,
    'eeee1111-0000-4000-8000-000000000005'::uuid,
    'eeee1111-0000-4000-8000-000000000006'::uuid,
    'eeee1111-0000-4000-8000-000000000002'::uuid,
    'eeee1111-0000-4000-8000-000000000003'::uuid,
    'eeee1111-0000-4000-8000-000000000004'::uuid
  ];
  v_slot_days TIME[] := ARRAY['08:10','08:40','10:10','10:40','08:10','08:40']::TIME[];
  v_expected  INTEGER := 6;
  v_placed    INTEGER;
  i           INTEGER;
BEGIN
  SELECT id INTO v_patient FROM users WHERE phone LIKE '%201000000001%' LIMIT 1;
  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'static test patient missing — run the earlier seeds first';
  END IF;

  SELECT bs.id INTO v_prep_svc
    FROM branch_services bs JOIN services s ON s.id = bs.service_id
   WHERE bs.branch_id = v_branch AND COALESCE(bs.is_available, TRUE)
     AND s.preparation_notes_ar IS NOT NULL
     AND s.preparation_notes_ar NOT LIKE 'لا يشترط%'
   ORDER BY bs.id LIMIT 1;

  SELECT bs.id INTO v_plain_svc
    FROM branch_services bs
   WHERE bs.branch_id = v_branch AND COALESCE(bs.is_available, TRUE)
     AND bs.id <> COALESCE(v_prep_svc, '00000000-0000-0000-0000-000000000000'::uuid)
   ORDER BY bs.id LIMIT 1;

  IF v_prep_svc IS NULL OR v_plain_svc IS NULL THEN
    RAISE EXCEPTION 'branch % has no available services — run seed 002 first', v_branch;
  END IF;

  -- ── RESET, over the seed's OWN footprint only ────────────────────────────
  DELETE FROM booking_services WHERE booking_id = ANY(v_ids);
  DELETE FROM bookings         WHERE id = ANY(v_ids);
  DELETE FROM slot_holds       WHERE slot_id = ANY(v_slot_ids);
  DELETE FROM slots            WHERE id = ANY(v_slot_ids);

  -- ── The slots the fixtures live on ───────────────────────────────────────
  FOR i IN 1..6 LOOP
    INSERT INTO slots (id, branch_id, slot_date, slot_time, capacity, booked_count, is_blocked)
    VALUES (v_slot_ids[i], v_branch,
            CASE WHEN i <= 4 THEN v_today ELSE v_tomorrow END,
            v_slot_days[i], 1, 1, FALSE);
  END LOOP;

  -- ── today · three cash bookings (the suite eats them in order) ───────────
  FOR i IN 1..3 LOOP
    INSERT INTO bookings (id, user_id, branch_id, slot_id, status, payment_status,
                          payment_method, total_amount, patient_notes, confirmed_at, created_at)
    VALUES (v_ids[i], v_patient, v_branch, v_slot_ids[i], 'confirmed', 'cash', 'cash',
            (SELECT price FROM branch_services WHERE id = v_plain_svc),
            'حجز اختباري — لوحة الشركاء', now(), now());
    INSERT INTO booking_services (booking_id, branch_service_id, price_at_booking, quantity)
    SELECT v_ids[i], v_plain_svc, price, 1 FROM branch_services WHERE id = v_plain_svc;
  END LOOP;

  -- ── today · prepaid, with preparation ────────────────────────────────────
  INSERT INTO bookings (id, user_id, branch_id, slot_id, status, payment_status,
                        payment_method, total_amount, confirmed_at, created_at)
  VALUES (v_ids[4], v_patient, v_branch, v_slot_ids[4], 'confirmed', 'paid', 'card',
          (SELECT price FROM branch_services WHERE id = v_prep_svc), now(), now());
  INSERT INTO booking_services (booking_id, branch_service_id, price_at_booking, quantity)
  SELECT v_ids[4], v_prep_svc, price, 1 FROM branch_services WHERE id = v_prep_svc;

  -- ── tomorrow · the Upcoming Days view needs rows, and the future-day tests
  --    need them OUTCOME-INELIGIBLE but still cancellable ──────────────────
  INSERT INTO bookings (id, user_id, branch_id, slot_id, status, payment_status,
                        payment_method, total_amount, patient_notes, confirmed_at, created_at)
  VALUES (v_ids[5], v_patient, v_branch, v_slot_ids[5], 'confirmed', 'cash', 'cash',
          (SELECT price FROM branch_services WHERE id = v_prep_svc),
          'من فضلكم اتصلوا قبل الموعد بساعة.', now(), now());
  INSERT INTO booking_services (booking_id, branch_service_id, price_at_booking, quantity)
  SELECT v_ids[5], v_prep_svc, price, 1 FROM branch_services WHERE id = v_prep_svc;

  INSERT INTO bookings (id, user_id, branch_id, slot_id, status, payment_status,
                        payment_method, total_amount, confirmed_at, created_at)
  VALUES (v_ids[6], v_patient, v_branch, v_slot_ids[6], 'confirmed', 'paid', 'card',
          (SELECT price FROM branch_services WHERE id = v_plain_svc), now(), now());
  INSERT INTO booking_services (booking_id, branch_service_id, price_at_booking, quantity)
  SELECT v_ids[6], v_plain_svc, price, 1 FROM branch_services WHERE id = v_plain_svc;

  -- ── ⚠ THE SEED ASSERTS ITS OWN OUTCOME ───────────────────────────────────
  -- Zero placement is now a SEED FAILURE, not a discovery four tests later.
  -- With ON_ERROR_STOP=1 this exits nonzero and the CI step fails naming the
  -- real cause, instead of the suite reporting a missing secret that is present.
  -- The E2E's FIXTURE TRIPWIRE stays as the second layer — it catches anything
  -- that consumes the fixtures BETWEEN seeding and the run.
  SELECT COUNT(*) INTO v_placed
    FROM bookings b
   WHERE b.id = ANY(v_ids) AND b.status = 'confirmed';

  IF v_placed <> v_expected THEN
    RAISE EXCEPTION
      'FIXTURE SEEDING PLACED % of % bookings. The suite will fail downstream with a message that blames something else — fix it here.',
      v_placed, v_expected;
  END IF;

  RAISE NOTICE 'fixtures placed: % of % (today %, tomorrow %)',
    v_placed, v_expected, v_today, v_tomorrow;
END $$;

-- Verification: SIX fixtures — four today (three cash, one prepaid), two
-- tomorrow (one cash, one prepaid) — each on a slot this file owns.
SELECT s.slot_date, s.slot_time, b.status, b.payment_status
  FROM bookings b JOIN slots s ON s.id = b.slot_id
 WHERE b.id::text LIKE 'eeee0000%'
 ORDER BY s.slot_date, s.slot_time;
