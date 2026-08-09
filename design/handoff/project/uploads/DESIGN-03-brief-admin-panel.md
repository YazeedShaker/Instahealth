# DESIGN-03 Brief — InstaHealth Admin Panel (Web)

> For a Claude Design session in the same project — extend the dashboard design system (shell,
> sidebar, row/card/table anatomy, status chips, the component contract). Desktop, 1366×768
> floor, Arabic-first RTL like everything else. Audience for sign-off: the three founders —
> you ARE the users this time.
> ALSO IN THIS SESSION (small addendum, patient app): a reviews-display section for the branch
> profile screen — average + count near the header (the card's rating pattern), and a reviews
> section: a few recent entries (stars, first name, relative date, text), empty state
> ("لا توجد تقييمات بعد"), and a "عرض الكل" affordance. Extends the existing mobile screen; do
> not redesign anything around it.

## Who uses this

The founders (initially: you), running the marketplace: onboarding partners, flipping launch
switches, watching operations, and producing the monthly numbers partners get invoiced with.
Density and truthfulness over polish; this is a cockpit, not a brochure. Visually it should
read as the dashboard's sibling with a distinct accent so nobody ever confuses which portal
they're in (e.g. the deep cerulean anchor role vs the partner portal's treatment).

## Screens, in priority order

1. **Login with the second factor** — email + password + TOTP code step (the ratified admin
   auth). Calm, minimal, clearly "الإدارة" not "بوابة الشركاء".
2. **Commission & invoicing report (THE screen — design it best).** Per
   DECISION-commission-attachment: per-partner, per-month statement — prepaid commission at
   payment, cash commission at completion, auto-closed (`closed_by = system`) bookings
   EXCLUDED and visibly footnoted ("أُغلقت تلقائياً — غير محتسبة"). Anatomy: partner picker +
   month picker → summary numbers (GMV, commissionable bookings, commission due) → the
   booking-level table backing every number (ref, date, method, event date, amount,
   commission) → export affordance (CSV/print) → an "invoice sent/settled" status the founder
   toggles manually in v1. Every number must be traceable to rows — this statement is what a
   partner disputes against.
3. **Providers & branches** — list + detail: the data the partner portal locks (name, hours,
   allocation, active status, pin/location) editable HERE, with the allocation editor carrying
   its consequence honestly ("changing allocation regenerates future days' slots" — design the
   confirm that says so), and the audit trail visible.
4. **Service catalog** — categories with the `is_active` launch switch (THE go-live dial per
   DECISION-provider-data-model — design the flip-confirm to feel as consequential as it is),
   services CRUD (AR/EN names, prep notes, category), and which branches offer each.
5. **Provider staff accounts** — the manual half of onboarding: create/disable a
   provider_users login for a branch (email, temp password flow), list per provider. (Role
   tiers land here later — design the column for it, ship without.)
6. **Bookings oversight** — cross-provider search (ref / patient phone / date / status),
   read-mostly with the P02 drawer pattern reused; admin cancel-on-behalf with
   `cancelled_by = 'admin'`.
7. **Ops overview (home)** — today across the network: bookings, fill rate per branch,
   cancellations, anything red (a dead cron, zero-slot branches). Small, glanceable, honest —
   design the "something is wrong" treatment.

## Constraints & truths

- Same Next.js app behind a role gate (`/admin`), same component contract — new patterns only
  where admin genuinely needs them (the statement table, the TOTP step, the launch switch).
- Everything money follows the ratified decisions verbatim; the design should FORCE the
  system-closed exclusion into visibility, not hide it in a tooltip.
- Manual-first v1: invoice status is a hand toggle, staff creation is manual, no automations
  drawn that don't exist.
- Out of scope: analytics/BI beyond the overview, refunds (no in-app payments in v1), doctor
  scheduling, patient-management beyond bookings oversight, notifications center.
