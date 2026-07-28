# DESIGN-02 Brief — Provider Dashboard (Web)

> For a Claude Design session in the same project as the patient app — inherit the design
> system (palette, Cairo/Atkinson, tokens, chips, cards) but adapt it to a DESKTOP web tool.
> Audience for sign-off: founders + ideally one real receptionist's reaction from Town/Saridar.

## Who uses this and what they're doing

**Primary persona: the branch receptionist.** Busy front desk, shared computer, interruptions
every 30 seconds. They need: "who is coming today from InstaHealth, are they paid or paying
here, mark what happened." Speed and glanceability beat features. Arabic UI, RTL, desktop
(1366×768 as the floor — old office machines), usable at arm's length.
**Secondary (design now, ship later):** branch/owner view — fill rate, upcoming days, prices.

## Screens to design (in priority order)

1. **Login** — email + password (providers don't use OTP), calm and minimal, InstaHealth
   branding + "بوابة الشركاء" framing.
2. **Today view (the home screen and the heart)** — today's bookings for THIS branch as a
   scannable list ordered by slot time: patient name + phone (tap-to-call), time, services
   summary, prep-required indicator, payment state (تم الدفع vs يدفع هنا — the cash
   distinction must be unmissable, it's money the desk collects), status chip, and the ONE
   primary action per row: mark وصل (arrived) → mark تمت الخدمة (completed) — or لم يحضر
   (no-show). Include: an "new booking just landed" affordance (row highlight + subtle sound
   toggle), empty state ("لا توجد حجوزات اليوم"), and a compact header with the branch name,
   date, and a fill indicator (٣/٥ محجوز اليوم).
3. **Booking detail** (drawer or panel off the list, not a page-leave) — full recap incl.
   booking ref, all services with prices, prep notes, patient contact, action history,
   cancel-on-behalf (phone cancellations happen at the desk).
4. **Upcoming days** — same list pattern with a date switcher (the strip pattern from mobile
   adapts); read-mostly.
5. **Services & prices editor** — the screen that retires our placeholder prices: the
   branch's service list with inline price editing, clear "آخر تحديث" per row, and a
   confirmation pattern that prevents fat-finger price disasters (e.g. type-to-confirm on
   > 50% changes). Design the empty/first-run state as the onboarding moment it will be.
6. **Slot allocation view** — read-only for receptionists (their daily slot times), with the
   owner-level edit (allocation count, time window) designed but visually gated.

## Patterns to establish (the system extension)

- Desktop density: tables/rows vs the mobile card language — define the row anatomy once.
- Status chip set EXTENDED for provider context: pending_payment, confirmed, arrived,
  completed, no_show, cancelled — colors consistent with mobile where states overlap.
- Realtime row arrival treatment; destructive-action confirms; toasts.
- Print stylesheet consideration for the Today view (desks print lists — design for it,
  even if v1 ships without the button).

## Constraints & truths from the build side

- Next.js web app, same repo; components hand off like the mobile screens did.
- Data model realities the design must reflect: payment is per-booking (paid/cash-pending),
  outcomes are receptionist-marked (arrived/completed/no_show — this design CREATES that
  workflow), bookings can arrive and cancel in realtime, and a branch has exactly N slots/day
  (fill rate is the number the whole business watches — give it the visual weight).
- Cancellation policy: patients cancel free anytime pre-slot; the desk sees cancellations
  immediately and can cancel-on-behalf.
- No reports/analytics screens in this session beyond the fill indicator (A-series later).

## Out of scope

Admin panel (A-series), owner analytics, patient-facing anything, doctor scheduling.
