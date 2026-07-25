-- ============================================================
-- Seed 002: Launch partners — Town Hospital + Saridar Labs
-- Source: docs/saridar-branches-template.md (2026-07-25 resolution pass)
-- IDEMPOTENT: fixed UUIDs + upserts on natural keys; safe to re-run.
--
-- Seeded: Town Hospital (New Cairo) + 23 Saridar branches — every branch
-- with resolved coordinates that is on the website and not flagged
-- "use only after confirmation". EXCLUDED (pending confirmation/links):
-- Maadi, Giza, Faisal 3, El-Mahla, Benha, Zagazig, Mansoura.
--
-- ⚠ ALL PRICES ARE PLACEHOLDERS (round numbers) — replace via provider
--   dashboard before real patients. Saridar hours use the standard
--   schedule until the per-branch-hours question is answered.
-- ============================================================

-- Launch switch: scans go live with F02 (labs already active from seed 001)
UPDATE service_categories SET is_active = TRUE WHERE slug IN ('labs', 'scans');

-- ── Providers ────────────────────────────────────────────────
INSERT INTO providers (id, name_ar, name_en, category_id, description_ar, description_en, is_active)
VALUES
  ('aaaa0000-0000-4000-8000-000000000001', 'مستشفى تاون', 'Town Hospital',
   NULL,
   'مستشفى متكامل في التجمع الخامس — معامل وأشعة على مدار الساعة.',
   'Full hospital in New Cairo — 24/7 labs & radiology.', TRUE),
  ('aaaa0000-0000-4000-8000-000000000002', 'معامل ساريدار', 'Saridar Labs',
   (SELECT id FROM service_categories WHERE slug = 'labs'),
   'سلسلة معامل تحاليل — خط ساخن ١٩٢٣٢.',
   'Lab chain — hotline 19232.', TRUE)
ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
  category_id = EXCLUDED.category_id, is_active = TRUE;

-- ── Branches ─────────────────────────────────────────────────
-- Town Hospital: 24/7 lab & radiology
INSERT INTO branches (id, provider_id, name_ar, name_en, address_ar, governorate, district, lat, lng, phone, operating_hours, slot_duration_minutes, instahealth_slot_allocation, is_active)
VALUES (
  'bbbb0000-0000-4000-8000-000000000001', 'aaaa0000-0000-4000-8000-000000000001',
  'مستشفى تاون — التجمع الخامس', 'Town Hospital — New Cairo',
  '١٤-١٥ شارع ٥٣ – الحي الثاني – التجمع الخامس', 'Cairo', 'التجمع الخامس',
  30.014288, 31.4379333, '15276',
  '{"sat":{"open":"00:00","close":"24:00","closed":false},"sun":{"open":"00:00","close":"24:00","closed":false},"mon":{"open":"00:00","close":"24:00","closed":false},"tue":{"open":"00:00","close":"24:00","closed":false},"wed":{"open":"00:00","close":"24:00","closed":false},"thu":{"open":"00:00","close":"24:00","closed":false},"fri":{"open":"00:00","close":"24:00","closed":false}}',
  30, 5, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar, address_ar = EXCLUDED.address_ar, district = EXCLUDED.district,
  lat = EXCLUDED.lat, lng = EXCLUDED.lng, phone = EXCLUDED.phone,
  operating_hours = EXCLUDED.operating_hours, is_active = TRUE;

-- Saridar: standard hours Sat–Thu 08:00–22:00, Fri 09:00–17:00 (⚠ per-branch hours unconfirmed)
INSERT INTO branches (id, provider_id, name_ar, name_en, address_ar, governorate, district, lat, lng, phone, operating_hours, slot_duration_minutes, instahealth_slot_allocation, is_active)
SELECT
  b.id::uuid, 'aaaa0000-0000-4000-8000-000000000002'::uuid,
  'ساريدار — ' || b.area_ar, 'Saridar — ' || b.area_en,
  b.address_ar, b.governorate, b.area_ar, b.lat, b.lng, b.phone,
  '{"sat":{"open":"08:00","close":"22:00","closed":false},"sun":{"open":"08:00","close":"22:00","closed":false},"mon":{"open":"08:00","close":"22:00","closed":false},"tue":{"open":"08:00","close":"22:00","closed":false},"wed":{"open":"08:00","close":"22:00","closed":false},"thu":{"open":"08:00","close":"22:00","closed":false},"fri":{"open":"09:00","close":"17:00","closed":false}}'::jsonb,
  30, 5, TRUE
FROM (VALUES
  ('bbbb0000-0000-4000-8000-000000000101', 'الدقي',            'Dokki',            '٩٢ شارع التحرير – برج ساريدار الطبي',                     'Giza',      30.038426, 31.210027, '02-37498860'),
  ('bbbb0000-0000-4000-8000-000000000102', 'المنيل',           'Manial',           '٥٢ شارع المنيل',                                          'Cairo',     30.018227, 31.224821, '02-23655295'),
  ('bbbb0000-0000-4000-8000-000000000103', 'فيصل ١',           'Faisal 1',         'برج الأطباء – أول شارع الملك فيصل',                       'Giza',      30.010863, 31.200129, '02-35696090'),
  ('bbbb0000-0000-4000-8000-000000000104', 'شبرا مصر',         'Shobra Masr',      '٥٣ شارع شبرا – برج السعد',                                'Cairo',     30.088799, 31.245355, '02-25787202'),
  ('bbbb0000-0000-4000-8000-000000000105', 'إمبابة',           'Imbaba',           '١٥ تقاطع شارع البوهي مع القومية',                          'Giza',      30.091500, 31.207683, '02-35424042'),
  ('bbbb0000-0000-4000-8000-000000000106', 'مدينة نصر',        'Nasr City',        '٤٨ شارع عباس العقاد',                                     'Cairo',     30.061382, 31.337753, '02-22742108'),
  ('bbbb0000-0000-4000-8000-000000000107', 'مصر الجديدة',      'Heliopolis',       '٤٠ شارع كليوباترا – ميدان صلاح الدين',                    'Cairo',     30.094712, 31.329687, '02-24151711'),
  ('bbbb0000-0000-4000-8000-000000000108', 'دار السلام',       'Dar Al Salam',     '١ شارع السيد حنفي من شارع الفيوم',                        'Cairo',     29.984388, 31.249290, '02-23160688'),
  ('bbbb0000-0000-4000-8000-000000000109', 'حلمية الزيتون',    'Helmiat Al Zaiton','٢٧ شارع ابن الحكم',                                       'Cairo',     30.111449, 31.317056, '02-26377058'),
  ('bbbb0000-0000-4000-8000-000000000110', 'السيدة زينب',      'Sayeda Zeinab',    '١٣ ميدان السيدة زينب',                                    'Cairo',     30.032627, 31.244059, '02-23920184'),
  ('bbbb0000-0000-4000-8000-000000000111', 'حلوان',            'Helwan',           '٢٦ أ شارع شريف باشا – ناصية شارع حيدر',                   'Cairo',     29.849652, 31.335471, '02-25560751'),
  ('bbbb0000-0000-4000-8000-000000000112', 'السادس من أكتوبر', '6th of October',   'لاسيتي مول – امتداد المحور الخدمي',                        'Giza',      29.972463, 30.939257, '02-38380611'),
  ('bbbb0000-0000-4000-8000-000000000113', 'فيصل ٢',           'Faisal 2',         '٣٢١ شارع الملك فيصل – محطة حسن محمد',                     'Giza',      30.002467, 31.171303, '02-39766054'),
  ('bbbb0000-0000-4000-8000-000000000114', 'المقطم',           'Mokattam',         '٢٠ شارع ٩',                                               'Cairo',     30.015285, 31.312786, '02-25041745'),
  ('bbbb0000-0000-4000-8000-000000000115', 'الهرم',            'Haram',            'شارع الهرم – ميراك سنتر – عمارة ٣ أ',                     'Giza',      29.994079, 31.159629, '02-33826507'),
  ('bbbb0000-0000-4000-8000-000000000116', 'الشيخ زايد',       'Sheikh Zayed',     'بلازا ٣٤ – الحي الثالث',                                  'Giza',      30.030786, 30.998493, '02-38514691'),
  ('bbbb0000-0000-4000-8000-000000000117', 'شبرا الخيمة',      'Shobra Al-Kheima', '١ شارع ١٣٥ – من شارع ١٥ مايو',                            'Qalyubia',  30.120436, 31.258938, '02-42215575'),
  ('bbbb0000-0000-4000-8000-000000000118', 'ناهيا',            'Nahia',            '٩٤ شارع ناهيا – بولاق الدكرور',                            'Giza',      30.043137, 31.185946, '02-37159344'),
  ('bbbb0000-0000-4000-8000-000000000119', 'شهاب',             'Shehab',           '١٧ شارع شهاب – المهندسين',                                'Giza',      30.051194, 31.195946, '02-37623425'),
  ('bbbb0000-0000-4000-8000-000000000120', 'كرداسة',           'Kerdasa',          '١ شارع سعد زغلول مع طريق المريوطية',                       'Giza',      30.036438, 31.119298, '19232'),
  ('bbbb0000-0000-4000-8000-000000000121', 'طنطا',             'Tanta',            '١٣ شارع المديرية',                                        'Gharbia',   30.794723, 31.016486, '040-3338224'),
  ('bbbb0000-0000-4000-8000-000000000122', 'شبين الكوم',       'Shebeen Al-Koum',  'برج الحكمة – ميدان شرف',                                  'Menoufia',  30.560456, 31.007948, '048-9101827'),
  ('bbbb0000-0000-4000-8000-000000000123', 'بني سويف',         'Beni Suef',        '٨٤ شارع أحمد عرابي',                                      'Beni Suef', 29.071370, 31.097882, '082-2134629')
) AS b(id, area_ar, area_en, address_ar, governorate, lat, lng, phone)
ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar, address_ar = EXCLUDED.address_ar, district = EXCLUDED.district,
  lat = EXCLUDED.lat, lng = EXCLUDED.lng, phone = EXCLUDED.phone,
  operating_hours = EXCLUDED.operating_hours, is_active = TRUE;

-- ── Scan services (category: scans) ─────────────────────────
INSERT INTO services (id, category_id, name_ar, name_en, preparation_notes_ar, preparation_notes_en, default_tat_hours, sort_order, is_active)
SELECT s.id::uuid, (SELECT id FROM service_categories WHERE slug = 'scans'),
       s.name_ar, s.name_en, s.prep_ar, s.prep_en, s.tat, s.sort_order, TRUE
FROM (VALUES
  ('cccc0000-0000-4000-8000-000000000001', 'أشعة عادية على الصدر', 'Chest X-ray', NULL, NULL, 2, 1),
  ('cccc0000-0000-4000-8000-000000000002', 'موجات صوتية على البطن', 'Abdominal Ultrasound',
   'صيام من ٦ إلى ٨ ساعات قبل الفحص.', 'Fast for 6–8 hours before the scan.', 2, 2),
  ('cccc0000-0000-4000-8000-000000000003', 'موجات صوتية على الحوض', 'Pelvic Ultrasound',
   'شرب ٤ أكواب ماء قبل الفحص بساعة وعدم التبول — الفحص يتطلب امتلاء المثانة.',
   'Drink 4 glasses of water one hour before and do not urinate — a full bladder is required.', 2, 3),
  ('cccc0000-0000-4000-8000-000000000004', 'أشعة مقطعية على المخ', 'CT Brain', NULL, NULL, 24, 4),
  ('cccc0000-0000-4000-8000-000000000005', 'رنين مغناطيسي على الركبة', 'MRI Knee',
   'أزل جميع المعادن والمجوهرات قبل الفحص وأبلغنا عن أي أجهزة معدنية مزروعة.',
   'Remove all metal and jewelry; tell us about any implanted metal devices.', 24, 5),
  ('cccc0000-0000-4000-8000-000000000006', 'ماموجرام', 'Mammogram',
   'تجنبي استخدام مزيل العرق أو البودرة يوم الفحص.',
   'Avoid deodorant or powder on the day of the exam.', 24, 6)
) AS s(id, name_ar, name_en, prep_ar, prep_en, tat, sort_order)
ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
  preparation_notes_ar = EXCLUDED.preparation_notes_ar,
  preparation_notes_en = EXCLUDED.preparation_notes_en, is_active = TRUE;

-- ── Branch services ──────────────────────────────────────────
-- PLACEHOLDER PRICES: labs tiered 150/250/400 by sort order; scans fixed rounds.

-- All seeded branches get the full lab menu (20 tests)
INSERT INTO branch_services (branch_id, service_id, price, is_available)
SELECT b.id, s.id,
       CASE s.sort_order % 3 WHEN 1 THEN 150 WHEN 2 THEN 250 ELSE 400 END,
       TRUE
FROM branches b
CROSS JOIN services s
WHERE b.provider_id IN ('aaaa0000-0000-4000-8000-000000000001', 'aaaa0000-0000-4000-8000-000000000002')
  AND s.category_id = (SELECT id FROM service_categories WHERE slug = 'labs')
ON CONFLICT (branch_id, service_id) DO UPDATE SET price = EXCLUDED.price, is_available = TRUE;

-- Scans: Town Hospital only (Saridar is labs-only)
INSERT INTO branch_services (branch_id, service_id, price, is_available)
SELECT 'bbbb0000-0000-4000-8000-000000000001'::uuid, s.id,
       CASE s.sort_order WHEN 1 THEN 300 WHEN 2 THEN 400 WHEN 3 THEN 400 WHEN 4 THEN 1500 WHEN 5 THEN 2500 ELSE 800 END,
       TRUE
FROM services s
WHERE s.category_id = (SELECT id FROM service_categories WHERE slug = 'scans')
ON CONFLICT (branch_id, service_id) DO UPDATE SET price = EXCLUDED.price, is_available = TRUE;

-- ── Slot backfill: next 7 days so Home has data immediately ──
-- Set-based (NOT the per-row generate_branch_slots loop — that exceeds the
-- platform statement timeout at 24 branches). Mirrors the same time grid;
-- idempotent via ON CONFLICT DO NOTHING. The nightly generate-slots Edge
-- Function keeps the 30-day window after this.
INSERT INTO slots (branch_id, slot_date, slot_time, capacity)
SELECT b.id, d.day, t::time, COALESCE(b.instahealth_slot_allocation, 5)
FROM branches b
CROSS JOIN LATERAL (
  SELECT gs::date AS day FROM generate_series(CURRENT_DATE, CURRENT_DATE + 7, interval '1 day') gs
) d
CROSS JOIN LATERAL (
  SELECT b.operating_hours -> (CASE EXTRACT(DOW FROM d.day)::int
    WHEN 0 THEN 'sun' WHEN 1 THEN 'mon' WHEN 2 THEN 'tue' WHEN 3 THEN 'wed'
    WHEN 4 THEN 'thu' WHEN 5 THEN 'fri' ELSE 'sat' END) AS h
) hours
CROSS JOIN LATERAL generate_series(
  d.day + (hours.h ->> 'open')::time,
  d.day + (hours.h ->> 'close')::time - make_interval(mins => COALESCE(b.slot_duration_minutes, 30)),
  make_interval(mins => COALESCE(b.slot_duration_minutes, 30))
) t
WHERE b.provider_id IN ('aaaa0000-0000-4000-8000-000000000001', 'aaaa0000-0000-4000-8000-000000000002')
  AND b.is_active = TRUE
  AND COALESCE((hours.h ->> 'closed')::boolean, TRUE) = FALSE
  AND (hours.h ->> 'open') IS NOT NULL
  AND (hours.h ->> 'close') IS NOT NULL
ON CONFLICT (branch_id, slot_date, slot_time) DO NOTHING;
