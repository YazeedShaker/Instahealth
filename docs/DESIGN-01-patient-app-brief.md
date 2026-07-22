# DESIGN-01 — Patient App Visual Design Brief

> The brief for the Claude Design session. Goal: produce polished, mobile, Arabic-RTL mockups of the
> core patient screens that become the visual contract for implementation. Read alongside PRODUCT.md.
> Mock the screens listed here — no more. Get co-founder sign-off, then specs reference these designs.

---

## The frame

- **Device:** mobile phone (design at ~390×844). Native app feel, not a website.
- **Direction:** RTL. Arabic is primary. Every screen laid out right-to-left.
- **Fonts:** Cairo (Arabic, all UI text). Atkinson Hyperlegible (any English/Latin, e.g. "EGP", "IH-2026-…").
- **Palette (exact):** primary CTA `#02C39A` · hover `#00A896` · secondary `#028090` ·
  deep anchor `#05668D` · cream accent `#F0F3BD`. Neutrals cool-gray. White backgrounds, teal actions.
- **Theme:** light (patient app is light-mode for MVP).
- **Tone:** calm, trustworthy, warm. Healthcare that reduces anxiety. Not clinical, not playful-childish.

---

## Screens to mock (the 6 that define the experience)

### 1. Onboarding / Auth (phone OTP)
- Welcome screen: logo, one-line Arabic value prop ("خدمتك الطبية أونلاين — احجز في دقائق"),
  a warm hero illustration (see illustration guidance), primary "ابدأ" (Start) button.
- Phone entry: `🇪🇬 +20` prefix locked, Arabic/Western numeral input, big clear CTA.
- OTP entry: 6-digit boxes, resend timer, edit-number link.
- States to show: empty, filled, error ("رقم غير صحيح"), loading.

### 2. Home / Discovery
- Top: location chip ("القاهرة — التجمع الخامس"), search bar ("ابحث عن تحليل، أشعة، طبيب…").
- Service categories as tappable cards WITH health icons: تحاليل (labs), أشعة (scans),
  أطباء (doctors). Only these three active; show how "coming soon" categories look (dimmed).
- "Nearby providers" list: provider card (name, type badge, distance, rating, open/closed,
  first-available slot). Town Hospital and Saridar as the real examples.
- Bottom tab bar: الرئيسية (Home), البحث (Search), حجوزاتي (Bookings), حسابي (Profile).

### 3. Branch / Provider profile
- Header: provider name, type, rating + review count, open/closed, distance, photos.
- Services list: each row = service name (Arabic), price in EGP, prep note indicator if any.
  Running "select services" interaction — checkboxes, a sticky total at the bottom.
- Preparation note callout using the CREAM accent (e.g. "صيام ١٢ ساعة مطلوب لتحليل الدهون").
- Sticky primary CTA: "احجز موعد" (Book appointment).

### 4. Booking flow (the 4 steps — show as a connected set)
- **Step 1 — Select services:** checklist + running total.
- **Step 2 — Pick slot:** date strip (next 14 days), time-slot grid. Available/selected/full states.
  When a slot is selected, show the **10-minute hold countdown** (a calm timer, turns amber near end).
- **Step 3 — Your details:** name (pre-filled), phone (confirmed), optional notes.
- **Step 4 — Payment:** order summary, payment method choice (card / Fawry / cash at branch),
  pay button showing the total.
- A visible 4-step progress indicator across the top.

### 5. Booking confirmation (the relief moment)
- Success illustration or Lottie checkmark (warm, reassuring).
- Booking ref (`IH-2026-00123`), provider, services, date/time, total.
- Preparation reminder (cream accent) repeated here.
- "SMS تم إرسالها" confirmation, add-to-calendar, "عرض حجوزاتي" button.

### 6. My Bookings (history)
- Tabs: القادمة (Upcoming) / السابقة (Past).
- Booking cards with status badges (مؤكد confirmed / قيد الانتظار pending / مكتمل completed /
  ملغي cancelled) — color + label together.
- Empty state (warm illustration + "لا توجد حجوزات بعد" + a nudge to book).
- Tap a booking → detail view with cancel option (and cancel-confirmation modal).

---

## States to include (don't skip these — they're half the product)

For each screen where relevant, mock: **loading** (skeletons, never blank), **empty**,
**error** (helpful, offers next action — never a dead end), **success**. The empty and error states
are where warmth matters most — use illustration here.

---

## Illustration & icon guidance

**Icons — use Health Icons (healthicons.org).** Open-source, public domain, health-specific
(lab tube, microscope, stethoscope, pill, ambulance, scan). One consistent style. Recolor to teal.
This is the icon system — don't mix in generic icon sets for medical concepts.

**Illustrations — pick ONE source and stay in it (consistency > variety):**
- **Recommended:** a single paid "friendly flat healthcare" vector pack (~$30, e.g. Gumroad/UI8/Craftwork).
  One illustrator = one visual language. Fully recolorable to our palette. Best look for the money.
- **Free alternatives:** Blush (blush.design) or Open Peeps / Humaaans — customizable characters you
  control the color of, so they don't look off-the-shelf.
- **Avoid unDraw as final art** — too recognizable as "MVP default," undercuts the trust we're building.
  Fine as temporary placeholder only.
- **Rule:** every illustration in the app comes from the same family. Never mix sources.

**Lottie (LottieFiles) — for moments, not decoration:**
- Booking-confirmed checkmark, empty-state animation, subtle loading pulse.
- All Lottie animations from a SINGLE illustrator/pack so they feel unified.
- Keep them subtle and fast — this is healthcare, not a game. Respect reduced-motion.

**Where illustration goes:** onboarding welcome, empty states, confirmation success, error states.
**Where it does NOT go:** dense functional screens (slot picker, service lists) — those stay clean
and uncluttered. Illustration is for emotional moments and empty space, not everywhere.

---

## Accessibility (must hold in the mockups)

- Text contrast ≥ 4.5:1 (normal), ≥ 3:1 (large). **Never teal `#02C39A` as body text on white** —
  use `#028090`/`#05668D` for teal-family text. Teal is for fills and large elements.
- Text on cream `#F0F3BD` must be `#05668D` or darker.
- Touch targets ≥ 44×44px.
- Status shown by color + text/icon together (never color alone).

---

## Deliverable from the session

- The 6 core screens above, mobile RTL, in our palette + fonts, with key states.
- A cohesive look the co-founders (Mohamed, Tarek) can react to and approve.
- Once approved: these become the visual contract. Feature specs (F01–F09) will reference them, and
  Claude Code implements against them. Note the chosen illustration source in PROGRESS.md so the whole
  app stays in one visual family.

---

## What NOT to design here

- Provider dashboard and admin panel — those are web desktop tools, they follow the design system
  directly without elaborate mockups. Don't spend the session on them.
- Doctor-appointment-specific screens — labs/scans first. Doctor booking comes after that's proven.
- Settings, legal, edge screens — later. Mock the core experience only.
