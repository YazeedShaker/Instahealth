INSERT INTO service_categories (name_ar, name_en, slug, icon, launch_phase, is_active, sort_order) VALUES
  ('تحاليل طبية',      'Laboratory Tests',        'labs',           '🔬', 1, TRUE,  1),
  ('أشعة وسونار',      'Radiology & Scans',       'scans',          '🩻', 1, FALSE, 2),
  ('أطباء وعيادات',    'Doctors & Clinics',       'doctors',        '🩺', 2, FALSE, 3),
  ('صيدليات',          'Pharmacies',              'pharmacies',     '💊', 2, FALSE, 4),
  ('عيادات أسنان',     'Dental Clinics',          'dental',         '🦷', 2, FALSE, 5),
  ('علاج طبيعي',       'Physiotherapy',           'physiotherapy',  '🏃', 3, FALSE, 6),
  ('زيارات منزلية',    'Home Visits',             'home-visits',    '🏠', 3, FALSE, 7),
  ('نساء وتوليد',      'Obstetrics & Gynecology', 'obgyn',          '🤱', 2, FALSE, 8),
  ('طب نفسي',          'Mental Health',            'mental-health',  '🧠', 3, FALSE, 9),
  ('تجميل وجلدية',     'Cosmetic & Dermatology',  'cosmetic',       '🌸', 4, FALSE, 10),
  ('مراكز تسريب',      'Infusion Centers',        'infusion',       '💉', 2, FALSE, 11),
  ('أورام وسرطان',     'Oncology',                'oncology',       '🎗️', 3, FALSE, 12),
  ('طوارئ وإسعاف',     'Emergency & Urgent Care', 'emergency',      '🚨', 3, FALSE, 13),
  ('طب رياضي',         'Sports Medicine',          'sports-medicine','⚽', 2, FALSE, 14),
  ('سيارات إسعاف',     'Ambulance',               'ambulance',      '🚑', 4, FALSE, 15);

INSERT INTO services (category_id, name_ar, name_en, preparation_notes_ar, preparation_notes_en, default_tat_hours, sort_order)
SELECT c.id, s.name_ar, s.name_en, s.prep_ar, s.prep_en, s.tat_hours, s.sort_order
FROM service_categories c,
(VALUES
  ('صورة دم كاملة (CBC)', 'Complete Blood Count (CBC)', 'لا يشترط صيام', 'No fasting required', 4, 1),
  ('سكر صائم', 'Fasting Blood Sugar (FBS)', 'صيام من ٨ إلى ١٢ ساعة قبل التحليل. يُسمح بشرب الماء فقط.', 'Fast for 8–12 hours before the test. Water is permitted.', 4, 2),
  ('سكر عشوائي', 'Random Blood Sugar (RBS)', 'لا يشترط صيام. يُؤخذ في أي وقت.', 'No fasting required. Can be taken at any time.', 4, 3),
  ('هيموجلوبين السكري (HbA1c)', 'Glycated Hemoglobin (HbA1c)', 'لا يشترط صيام. يعكس متوسط السكر خلال ٣ أشهر.', 'No fasting required. Reflects average blood sugar over 3 months.', 6, 4),
  ('وظائف كلى (Urea & Creatinine)', 'Kidney Function Tests (BUN & Creatinine)', 'يُفضَّل الصيام ٨ ساعات. تجنب الإجهاد الشديد قبل التحليل.', 'Fasting for 8 hours preferred. Avoid intense exercise beforehand.', 6, 5),
  ('وظائف كبد (LFTs)', 'Liver Function Tests (LFTs)', 'صيام من ٨ إلى ١٢ ساعة. تجنب الكحول قبل ٢٤ ساعة.', 'Fast for 8–12 hours. Avoid alcohol for 24 hours prior.', 6, 6),
  ('دهون ثلاثية وكوليسترول (Lipid Profile)', 'Lipid Profile (Cholesterol & Triglycerides)', 'صيام كامل ١٢ ساعة ضروري. الماء فقط مسموح.', 'A full 12-hour fast is required. Water only is permitted.', 6, 7),
  ('هرمونات الغدة الدرقية (TSH)', 'Thyroid Function (TSH)', 'لا يشترط صيام. يُفضَّل أخذ العينة صباحاً قبل الأدوية.', 'No fasting required. Preferred in the morning before medication.', 8, 8),
  ('فيتامين د (Vitamin D 25-OH)', 'Vitamin D (25-OH)', 'لا يشترط صيام.', 'No fasting required.', 8, 9),
  ('فيتامين ب ١٢', 'Vitamin B12', 'لا يشترط صيام.', 'No fasting required.', 8, 10),
  ('الكشف عن فيروس سي (HCV Ab)', 'Hepatitis C Antibody (HCV Ab)', 'لا يشترط صيام.', 'No fasting required.', 6, 11),
  ('الكشف عن فيروس B (HBsAg)', 'Hepatitis B Surface Antigen (HBsAg)', 'لا يشترط صيام.', 'No fasting required.', 6, 12),
  ('تحليل بول كامل (Urinalysis)', 'Complete Urinalysis', 'عينة أول صباح أفضل. تجنب البول مباشرة قبل الاختبار. يُعطى الحاوي من المختبر.', 'First morning urine is preferred. A specimen container will be provided.', 4, 13),
  ('ثقافة بول (Urine Culture)', 'Urine Culture & Sensitivity', 'عينة وسط المجرى. نظّف المنطقة جيداً قبل الأخذ. أبلغ عن أي مضادات حيوية تتناولها.', 'Midstream clean-catch sample. Inform us of any current antibiotics.', 48, 14),
  ('تحليل براز', 'Stool Analysis', 'عينة طازجة في حاوية التحاليل الخاصة. تجنب الملوّنات الغذائية قبل التحليل.', 'Fresh sample in the provided container. Avoid food dyes beforehand.', 24, 15),
  ('حمض اليوريك (Uric Acid)', 'Uric Acid', 'صيام ٤ إلى ٨ ساعات. تجنب الكحول والأطعمة الغنية بالبيورين يوم التحليل.', 'Fast for 4–8 hours. Avoid alcohol and purine-rich foods on the test day.', 4, 16),
  ('بروتين سي التفاعلي (CRP)', 'C-Reactive Protein (CRP)', 'لا يشترط صيام.', 'No fasting required.', 6, 17),
  ('معدل ترسيب الدم (ESR)', 'Erythrocyte Sedimentation Rate (ESR)', 'لا يشترط صيام.', 'No fasting required.', 4, 18),
  ('حديد وفيريتين (Iron Studies)', 'Iron Studies (Fe, TIBC & Ferritin)', 'صيام ١٢ ساعة. أخذ العينة صباحاً لأن مستوى الحديد يتغير خلال اليوم.', 'Fast for 12 hours. Morning sample preferred — iron levels vary throughout the day.', 8, 19),
  ('فصيلة الدم ورايزس (Blood Group)', 'Blood Group & Rh Factor', 'لا يشترط صيام.', 'No fasting required.', 4, 20)
) AS s(name_ar, name_en, prep_ar, prep_en, tat_hours, sort_order)
WHERE c.slug = 'labs';
