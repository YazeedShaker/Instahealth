# DECISION — Navigation Chrome & Safe Areas

> Global UI rules for the bottom tab bar and safe-area handling across the patient app. Captured from
> DESIGN-01 review. Applies to ALL patient-app feature specs. Referenced by PRODUCT.md §5.

---

## Decision 1 — Bottom tab bar: persistent on destinations, HIDDEN during focused flows

The bottom tab bar (الرئيسية · البحث · حجوزاتي · حسابي) is a primary navigation pattern and should be
present on the app's main destinations — but it is **deliberately hidden during linear, focused tasks**
where leaving mid-way costs the patient something.

**Tab bar VISIBLE on:**

- Home / Discovery
- Search & results
- My Bookings (list + detail)
- Profile
- Branch / provider profile (browsing — patient may still be exploring)

**Tab bar HIDDEN on:**

- The entire **booking flow** (step 1 review → step 2 slot → step 3 details → step 4 payment)
- **Onboarding / auth** (welcome, phone entry, OTP)
- Any full-screen modal task

**Why hidden during booking:** the booking flow is a commitment funnel with a live 10-minute slot
hold. A visible tab bar invites the patient to tap away ("الرئيسية"/"حجوزاتي") and abandon the booking
mid-payment, silently dropping their held slot. Every serious checkout flow (Talabat, Uber, Booking,
airlines) removes tab navigation during checkout to keep the user in the funnel. The way out is the
back arrow or an explicit cancel — not a casual tab tap. Hiding tabs also gives the booking screens
full height and makes the single sticky CTA unambiguous.

**Acceptance criteria (all patient specs):**

- [ ] Tab bar renders on the five destination screens above.
- [ ] Tab bar is absent on all 4 booking-flow steps and all auth screens.
- [ ] Leaving the booking flow is only via back arrow or explicit cancel (which releases the hold).

---

## Decision 2 — Safe areas: every sticky/bottom element sits INSIDE the safe area

Observed in the DESIGN-01 mockup: the sticky "التالي" CTA sat flush against the bottom edge, where the
iOS home indicator / Android gesture bar lives — it would be overlapped on real devices.

**The rule (global):**

- Every **sticky bottom element** — primary CTAs, the tab bar, the hold-countdown banner — must sit
  **inside** the bottom safe-area inset, floating above the home indicator with padding. Never flush to
  the physical bottom edge.
- Same for the **top:** headers/status respect the top inset (notch / status bar).
- Mobile (React Native): use `react-native-safe-area-context` (`useSafeAreaInsets()` /
  `SafeAreaView`). Web (patient PWA later): `env(safe-area-inset-*)`.
- The sticky CTA on booking screens occupies the space where the tab bar would be (since tabs are
  hidden in the flow) — but still padded above the home indicator.

**Acceptance criteria (all patient specs):**

- [ ] No interactive element is ever under the iOS home indicator or Android gesture bar.
- [ ] Sticky CTAs, tab bar, and countdown banner all clear the bottom inset with padding.
- [ ] Headers clear the top inset (notch / status bar).
- [ ] Verified on a real device (or a notched simulator), not just the design canvas.

---

## Minor content fix noted in the same mockup

- The total row read "الإجمالي ٢٠ تحاليل" — a text glitch mixing a count into the total. It should read
  "الإجمالي" with the amount "٢٤٥ EGP" only. No service count in the total row.

---

## Summary (what Claude Code builds to)

1. Tab bar is **persistent on destinations, hidden during the booking flow and auth** — keep patients
   in the commitment funnel; exit only via back/cancel.
2. **All sticky/bottom elements respect the safe-area inset** — nothing under the home indicator, ever.

_Last updated: July 2026._
