# RUNBOOK — Monthly commission invoicing

> The founder-executable procedure for billing a partner. A02 built the screen;
> this is how it is used, and what to do when it says something unexpected.
>
> **Where:** `/admin/commissions` · **Who:** the founder (admin, TOTP) ·
> **When:** in the first days of the month, for the month that just ended.

---

## ⚠ Before the first real statement, ONCE

**The commission rates in the database are PLACEHOLDERS — 12% for both
partners, backfilled by A02 because no signed rate exists yet.** Every
backfilled row carries a `note` saying so.

The statement will compute, issue and export perfectly against a wrong number.
Nothing in the system can detect that the rate is wrong — a missing rate throws,
but a _wrong_ one is indistinguishable from a right one. Only a human comparing
it to a signed agreement catches it.

So: **enter the agreed rates through A03 before sending any partner a real
statement.** Until then, treat every figure as a rehearsal.

---

## The monthly procedure

### 1 · Pick the partner and the month

The scope bar has exactly two controls, by design: a partner and a **calendar
month**. There are no arbitrary date ranges — a partner is invoiced for a month,
so the statement is a month.

The URL carries the scope (`?provider=…&month=…&version=…`), which means a
statement is **linkable**. Send the link, not a screenshot.

### 2 · Read the draft before issuing anything

Until you issue, the screen says «لم تُصدر بعد» and the numbers are LIVE — they
move as the branch completes visits. That is correct: nothing is owed to a
partner for a visit that has not happened.

Check three things, in this order:

1. **The excluded strip.** «أُغلقت تلقائياً — غير محتسبة» counts bookings the
   nightly job closed after 24 hours because the desk never confirmed the
   patient arrived. They earn no commission. **A large number here is an
   operational problem, not an accounting one** — it means a branch is not
   marking outcomes, and every one of those visits may have actually happened.
   Talk to the branch before you send the statement, not after.
2. **The method split.** In v1 every real booking is cash, so the card should
   read «كلها نقداً بالفرع». Prepaid rows appearing means either card payments
   have returned, or you are looking at pre-2026-08 historical data.
3. **The rate footnote.** «النسبة السارية: ١٢٪» — confirm it against the
   agreement. If the month spans a rate change, it reads «نسب سارية: … — إجمالي
   مركّب» and each row shows the rate in force on its own event date.

**Every number on this screen is a sum of the rows beneath it.** If a card and
the table disagree, stop and report it — that is a bug, not a rounding quirk.

### 3 · Issue and send

Press **«تحديد كمُرسلة»**. On a month that has never been issued this does two
things at once: it FREEZES the numbers into a permanent version, and it marks
that version sent. The freeze is the point — from here the partner's document
cannot change under them.

Then send the partner the export:

- **⤓ CSV** — opens in Excel with Arabic intact. Every row carries both the
  Arabic figure and a raw piaster column, so an accountant can sum it.
- **⎙ طباعة** — the print sheet. Chrome renders it landscape with the chrome
  stripped.

Both carry the partner, the month, the version, the status and the «أُصدرت في»
stamp, and both print the excluded-bookings footnote in full **even when the
rows are hidden on screen**. A partner can never hold a page that does not say
which version it is.

### 4 · When they pay, mark it settled

Press **«تحديد كمُسوّاة»**. This is terminal: the statement locks, «🔒 لا تعديل
بعد التسوية» appears, and no further version can be issued for that month.

---

## When the screen tells you something changed

### «تغيّرت البيانات بعد الإصدار» — a red strip, before settlement

A branch completed a late visit that belongs to the month you already sent. The
strip shows the difference in commission.

**Do not edit the statement — there is no way to, deliberately.** Press
**«إعادة إصدار»**, confirm the dialog (it shows the old total beside the new
one), and send the partner the new version. The previous version stays readable,
marked «نسخة ملغاة», and still exports — so if the partner queries the first
document you can both look at exactly what they were sent.

The re-issued version comes back as «مسودة» until you mark it sent again.

### «وصل تغيير بعد التسوية» — a blue note, after settlement

The same thing, but the month is already paid. A settled statement is never
re-issued and never edited. The difference is **carried forward**: add it to the
next month's invoice and tell the partner it is a carry-over from the previous
month.

This is a NOTE, not a ledger. There is no credits engine in v1 — you are being
told a number to carry, and carrying it is a manual step.

---

## Things that look like errors and are not

| What you see                                | What it means                                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| «لا حجوزات محتسبة في هذا الشهر»             | A real zero. The partner had no completed cash visits and no prepaid payments that month. Cancellations earn nothing, by design. |
| A booking missing that you expected         | Cancelled, or a human-marked no-show. Neither earns commission. Only _auto-closed_ bookings get a visible struck-through row.    |
| «لا جديد منذ آخر إصدار» when re-issuing     | Nothing has changed, so a new version would differ from the last only by a timestamp. Refused on purpose.                        |
| The total not matching your own spreadsheet | Check whether you included auto-closed bookings. They are in the excluded strip and in no total.                                 |

---

## What this runbook deliberately does NOT cover

- **Editing a rate.** That is A03, and it is append-only: a change is a new row
  with an effective date, never an edit. Past statements keep the rate that was
  in force when each booking's commission attached.
- **Refunds or credit notes.** Out of scope while v1 collects cash only. When
  card payments return, a refunded prepaid booking must reverse its commission —
  that lands with the PayTabs integration.
- **Chasing payment.** There is no dunning, no reminders, no aging report. The
  statuses are «مسودة / أُرسلت / تمت التسوية» and you move them by hand, because
  in v1 the truth about whether a partner has paid lives in a conversation, not
  in the database.

---

_Written with A02 (2026-08-09). Update it when A03 lands the rate editor._
