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
-- FIVE bookings, three of them today, because the tests also consume each
-- other's fixtures WITHIN a single run: the outcome test eats the first
-- actionable booking, starving the cash-row and cancel-on-behalf tests that
-- follow. A spare cash booking is far cheaper than making every test build its
-- own world.
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
  v_slot      UUID;
  v_ids       UUID[] := ARRAY[
    'eeee0000-0000-4000-8000-000000000001'::uuid,  -- today · cash
    'eeee0000-0000-4000-8000-000000000005'::uuid,  -- today · cash (spare)
    'eeee0000-0000-4000-8000-000000000006'::uuid,  -- today · cash (spare 2)
    'eeee0000-0000-4000-8000-000000000002'::uuid,  -- today · prepaid
    'eeee0000-0000-4000-8000-000000000003'::uuid,  -- tomorrow · cash + prep
    'eeee0000-0000-4000-8000-000000000004'::uuid   -- tomorrow · prepaid
  ];
  -- Today's CASH bookings, in the order the suite eats them. THREE of them, not
  -- two: the swallowed-completion fix added two more tests that each consume an
  -- actionable booking (one completes, one arrives), and with only two cash rows
  -- seeded that starved `a cash row is unmissable` and `cancel-on-behalf …` —
  -- they began SKIPPING, which is the precise failure this whole area exists to
  -- prevent. Today has 5 slots at capacity 1, so 4 fixtures leave one free.
  v_today_cash UUID[] := ARRAY[v_ids[1], v_ids[2], v_ids[3]];
  v_id        UUID;
BEGIN
  SELECT id INTO v_patient FROM users WHERE phone LIKE '%201000000001%' LIMIT 1;
  IF v_patient IS NULL THEN
    RAISE NOTICE 'static test patient missing — run the earlier seeds first';
    RETURN;
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

  -- Reset: drop any previous incarnation and give its slot capacity back, so
  -- state is rebuilt rather than accumulated.
  FOREACH v_id IN ARRAY v_ids LOOP
    UPDATE slots SET booked_count = GREATEST(0, booked_count - 1)
     WHERE id = (SELECT slot_id FROM bookings WHERE id = v_id);
    DELETE FROM booking_services WHERE booking_id = v_id;
    DELETE FROM bookings WHERE id = v_id;
  END LOOP;

  -- ── today · cash, plus two spares ───────────────────────────────────────
  FOR v_id IN SELECT unnest(v_today_cash) LOOP
    SELECT id INTO v_slot FROM slots
     WHERE branch_id = v_branch AND slot_date = v_today AND booked_count < capacity
     ORDER BY slot_time LIMIT 1;
    EXIT WHEN v_slot IS NULL;

    INSERT INTO bookings (id, user_id, branch_id, slot_id, status, payment_status,
                          payment_method, total_amount, patient_notes, confirmed_at, created_at)
    VALUES (v_id, v_patient, v_branch, v_slot, 'confirmed', 'cash', 'cash',
            (SELECT price FROM branch_services WHERE id = v_plain_svc),
            'حجز اختباري — لوحة الشركاء', now(), now());
    INSERT INTO booking_services (booking_id, branch_service_id, price_at_booking, quantity)
    SELECT v_id, v_plain_svc, price, 1 FROM branch_services WHERE id = v_plain_svc;
    UPDATE slots SET booked_count = booked_count + 1 WHERE id = v_slot;
  END LOOP;

  -- ── today · prepaid, with preparation (index 4) ──────────────────────────
  SELECT id INTO v_slot FROM slots
   WHERE branch_id = v_branch AND slot_date = v_today AND booked_count < capacity
   ORDER BY slot_time LIMIT 1;
  IF v_slot IS NOT NULL THEN
    INSERT INTO bookings (id, user_id, branch_id, slot_id, status, payment_status,
                          payment_method, total_amount, confirmed_at, created_at)
    VALUES (v_ids[4], v_patient, v_branch, v_slot, 'confirmed', 'paid', 'card',
            (SELECT price FROM branch_services WHERE id = v_prep_svc), now(), now());
    INSERT INTO booking_services (booking_id, branch_service_id, price_at_booking, quantity)
    SELECT v_ids[4], v_prep_svc, price, 1 FROM branch_services WHERE id = v_prep_svc;
    UPDATE slots SET booked_count = booked_count + 1 WHERE id = v_slot;
  END IF;

  -- ── tomorrow · the Upcoming Days view needs rows, and the future-day tests
  --    need them OUTCOME-INELIGIBLE but still cancellable ──────────────────
  SELECT id INTO v_slot FROM slots
   WHERE branch_id = v_branch AND slot_date = v_tomorrow AND booked_count < capacity
   ORDER BY slot_time LIMIT 1;
  IF v_slot IS NOT NULL THEN
    INSERT INTO bookings (id, user_id, branch_id, slot_id, status, payment_status,
                          payment_method, total_amount, patient_notes, confirmed_at, created_at)
    VALUES (v_ids[5], v_patient, v_branch, v_slot, 'confirmed', 'cash', 'cash',
            (SELECT price FROM branch_services WHERE id = v_prep_svc),
            'من فضلكم اتصلوا قبل الموعد بساعة.', now(), now());
    INSERT INTO booking_services (booking_id, branch_service_id, price_at_booking, quantity)
    SELECT v_ids[5], v_prep_svc, price, 1 FROM branch_services WHERE id = v_prep_svc;
    UPDATE slots SET booked_count = booked_count + 1 WHERE id = v_slot;
  END IF;

  SELECT id INTO v_slot FROM slots
   WHERE branch_id = v_branch AND slot_date = v_tomorrow AND booked_count < capacity
   ORDER BY slot_time LIMIT 1;
  IF v_slot IS NOT NULL THEN
    INSERT INTO bookings (id, user_id, branch_id, slot_id, status, payment_status,
                          payment_method, total_amount, confirmed_at, created_at)
    VALUES (v_ids[6], v_patient, v_branch, v_slot, 'confirmed', 'paid', 'card',
            (SELECT price FROM branch_services WHERE id = v_plain_svc), now(), now());
    INSERT INTO booking_services (booking_id, branch_service_id, price_at_booking, quantity)
    SELECT v_ids[6], v_plain_svc, price, 1 FROM branch_services WHERE id = v_plain_svc;
    UPDATE slots SET booked_count = booked_count + 1 WHERE id = v_slot;
  END IF;
END $$;

-- Verification: SIX fixtures — four today (three cash, one prepaid), two
-- tomorrow (one cash, one prepaid).
SELECT s.slot_date, b.status, b.payment_status, COUNT(*)
  FROM bookings b JOIN slots s ON s.id = b.slot_id
 WHERE b.id::text LIKE 'eeee0000%'
 GROUP BY s.slot_date, b.status, b.payment_status
 ORDER BY s.slot_date, b.payment_status;
