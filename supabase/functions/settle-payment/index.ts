// settle-payment — THE booking settlement path.
//
// This is the only caller of confirm_booking() (migration 20260727111326
// revoked EXECUTE from anon/authenticated). The client never confirms a
// booking and never writes a payments row; it takes the money via a
// PaymentProvider and hands the OUTCOME here.
//
// Two callers, one path:
//   · today  — the mobile payment screen posts the MockPaymentProvider result.
//   · later  — PayTabs' IPN handler posts the same shape after verifying the
//              callback signature. Nothing in this file changes.
//
// IDEMPOTENT BY CONSTRUCTION: PayTabs retries IPNs until it gets a 2xx, so a
// second settle for an already-confirmed booking returns the confirmed state
// instead of erroring or double-charging.
//
// AUTH is two layers. The platform's verify_jwt rejects unauthenticated calls
// before this code runs; this file then resolves the caller from that same
// bearer token and requires the booking's user_id to match. A patient can
// therefore only ever settle their OWN booking.
// (When the PayTabs IPN lands it gets its OWN function, which verifies the
// PayTabs signature and then calls this one — the signature is the auth there.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SEND_SMS_URL = `${SUPABASE_URL}/functions/v1/send-sms`

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// ── Mirrored from packages/core (Edge Functions are standalone Deno modules
// and cannot import the workspace package — same reason send-sms re-implements
// core's phone rules). Keep these in step with core in the SAME PR. ─────────

/** MIRRORS core `constants/index.ts` STATIC_TEST_PHONES. */
const STATIC_TEST_PHONES = ['+201000000001', '+201000000002']
/** MIRRORS core `constants/index.ts` SMS_MAX_LENGTH. */
const SMS_MAX_LENGTH = 140
/** MIRRORS core `business/payment.ts` PAYMENT_METHODS (= the DB check constraint). */
const PAYMENT_METHODS = ['card', 'fawry', 'vodafone_cash', 'orange_cash', 'cash']

type PaymentMethod = (typeof PAYMENT_METHODS)[number]
type PaymentOutcome = 'success' | 'failure'

interface SettleRequest {
  bookingId: string
  method: PaymentMethod
  providerRef: string
  outcome: PaymentOutcome
  providerPayload: Record<string, unknown> | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** MIRRORS core `schemas/payment.schema.ts` settlePaymentRequestSchema. */
function parseRequest(body: unknown): SettleRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const raw = body as Record<string, unknown>
  const { bookingId, method, providerRef, outcome, providerPayload } = raw
  if (typeof bookingId !== 'string' || !UUID_RE.test(bookingId)) return null
  if (typeof method !== 'string' || !PAYMENT_METHODS.includes(method)) return null
  if (typeof providerRef !== 'string' || providerRef.length === 0 || providerRef.length > 255) {
    return null
  }
  if (outcome !== 'success' && outcome !== 'failure') return null
  const payload =
    providerPayload === undefined || providerPayload === null
      ? null
      : typeof providerPayload === 'object' && !Array.isArray(providerPayload)
        ? (providerPayload as Record<string, unknown>)
        : null
  return { bookingId, method, providerRef, outcome, providerPayload: payload }
}

/** MIRRORS core `business/phone.ts` normalizeEgyptianPhone (E.164 output). */
function normalizeEgyptianPhone(input: string): string | null {
  const digitsOnly = input.replace(/[\s\-().]/g, '')
  if (!/^\+?\d+$/.test(digitsOnly)) return null
  let digits = digitsOnly.replace(/^\+/, '')
  if (digits.startsWith('0020')) digits = digits.slice(4)
  else if (digits.startsWith('20')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = digits.slice(1)
  const candidate = `20${digits}`
  return /^20(10|11|12|15)[0-9]{8}$/.test(candidate) ? `+${candidate}` : null
}

/** MIRRORS core `business/phone.ts` isStaticTestPhone. */
function isStaticTestPhone(input: string): boolean {
  const normalized = normalizeEgyptianPhone(input)
  return normalized !== null && STATIC_TEST_PHONES.includes(normalized)
}

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** MIRRORS core `business/format.ts` toArabicDigits. */
function toArabicDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => ARABIC_INDIC_DIGITS[Number(digit)])
}

/** MIRRORS core `business/format.ts` formatTimeShortAr. */
function formatTimeShortAr(time: string): string {
  const [hourStr = '0', minuteStr = '00'] = time.split(':')
  const hour = Number(hourStr) % 24
  const minute = Number(minuteStr)
  const suffix = hour < 12 ? 'ص' : 'م'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  const base = minute === 0 ? String(hour12) : `${hour12}:${String(minute).padStart(2, '0')}`
  return `${toArabicDigits(base)}${suffix}`
}

/** MIRRORS core `business/format.ts` formatArabicDate — Cairo-pinned, so the
 * SMS names the same day the patient saw in the picker regardless of server TZ. */
const ARABIC_DATE_FORMATTER = new Intl.DateTimeFormat('ar-EG', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Africa/Cairo',
})

function formatArabicDate(slotDate: string): string {
  // Noon UTC keeps the calendar day stable across the +02:00 offset.
  return ARABIC_DATE_FORMATTER.format(new Date(`${slotDate}T12:00:00Z`))
}

/** MIRRORS core `business/preparation.ts` isReassurancePrepNote. */
function isReassurancePrepNote(note: string | null): boolean {
  if (note === null) return false
  const normalized = note.replace(/\s+/g, ' ').trim().toLowerCase()
  if (normalized.length === 0) return false
  return ['لا يشترط', 'no fasting required'].some((prefix) => normalized.startsWith(prefix))
}

/** MIRRORS core `business/preparation.ts` parseFastingHours. */
function parseFastingHours(noteAr: string | null, noteEn: string | null): number | null {
  const combined = `${noteAr ?? ''} ${noteEn ?? ''}`.trim()
  if (combined.length === 0) return null
  const normalized = combined
    .replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (char) => String(char.charCodeAt(0) - 0x06f0))
    .toLowerCase()
  if (['لا يشترط', 'no fasting'].some((marker) => normalized.includes(marker.toLowerCase()))) {
    return null
  }
  if (
    !normalized.includes('صيام') &&
    !normalized.includes('الصيام') &&
    !normalized.includes('fast')
  ) {
    return null
  }
  const hours = [...normalized.matchAll(/\d+/g)].map((match) => Number(match[0]))
  return hours.length === 0 ? null : Math.max(...hours)
}

/** MIRRORS core `business/sms.ts` formatPrepSmsNoteAr. The FULL service note
 * never fits beside the booking details in a 140-char Unicode SMS, so the
 * message carries the consolidated rule (longest fast wins) instead. */
function formatPrepSmsNoteAr(services: ConfirmationServiceRow[]): string | null {
  const realNotes = services.filter(
    (service) =>
      service.preparationNotesAr !== null &&
      service.preparationNotesAr.trim().length > 0 &&
      !isReassurancePrepNote(service.preparationNotesAr),
  )
  if (realNotes.length === 0) return null
  const fastingHours = realNotes
    .map((service) => parseFastingHours(service.preparationNotesAr, service.preparationNotesEn))
    .filter((hours): hours is number => hours !== null && hours > 0)
  if (fastingHours.length > 0) {
    return `صيام ${toArabicDigits(String(Math.max(...fastingHours)))} ساعة قبل الموعد`
  }
  return 'يلزم تحضير قبل الموعد — التفاصيل في التطبيق'
}

/** MIRRORS core `business/sms.ts` buildConfirmationSmsAr — locked by
 * `packages/core/src/business/sms.test.ts`. Change both together. */
function buildConfirmationSmsAr(input: {
  bookingRef: string | null
  branchNameAr: string
  dateLabelAr: string
  timeLabelAr: string
  prepNoteAr: string | null
}): string {
  const refPart = input.bookingRef !== null ? ` رقم الحجز: ${input.bookingRef}.` : ''
  const base = `تم تأكيد حجزك في ${input.branchNameAr} يوم ${input.dateLabelAr} الساعة ${input.timeLabelAr}.${refPart}`
  if (input.prepNoteAr === null) return base.slice(0, SMS_MAX_LENGTH)
  const withPrep = `${base} تجهيز: ${input.prepNoteAr}`
  return withPrep.length <= SMS_MAX_LENGTH ? withPrep : base.slice(0, SMS_MAX_LENGTH)
}

// ── Helpers ────────────────────────────────────────────────────────────────

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

function fail(error: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error }), { status, headers: JSON_HEADERS })
}

interface ConfirmationServiceRow {
  id: string
  nameAr: string
  nameEn: string
  priceEgp: number
  preparationNotesAr: string | null
  preparationNotesEn: string | null
}

/** The DTO the confirmation screen renders. Built here, server-side, because
 * the patient's `slots` SELECT policy hides a slot once booked_count reaches
 * capacity — after confirming, the client can no longer read its OWN slot. */
async function buildConfirmation(bookingId: string) {
  const { data, error } = await admin
    .from('bookings')
    .select(
      'id, booking_ref, total_amount, payment_method, confirmed_at, user_id,' +
        'slot:slots!inner(slot_date, slot_time),' +
        'branch:branches!inner(name_ar, address_ar),' +
        'booking_services(price_at_booking, branch_service:branch_services!inner(service:services!inner(id, name_ar, name_en, preparation_notes_ar, preparation_notes_en, category:service_categories!inner(slug))))',
    )
    .eq('id', bookingId)
    .single()
  if (error || !data) return null

  const slot = Array.isArray(data.slot) ? data.slot[0] : data.slot
  const branch = Array.isArray(data.branch) ? data.branch[0] : data.branch
  if (!slot || !branch) return null

  const services: ConfirmationServiceRow[] = []
  let isHospital = false
  for (const row of data.booking_services ?? []) {
    const branchService = Array.isArray(row.branch_service) ? row.branch_service[0] : row.branch_service
    const service = Array.isArray(branchService?.service) ? branchService.service[0] : branchService?.service
    if (!service) continue
    const category = Array.isArray(service.category) ? service.category[0] : service.category
    // Type badge is DERIVED from categories — there is no provider-type column
    // (ENGINEERING-WORKFLOW §7). scans present → مستشفى, otherwise معمل تحاليل.
    if (category?.slug === 'scans') isHospital = true
    services.push({
      id: service.id,
      nameAr: service.name_ar,
      nameEn: service.name_en,
      priceEgp: Number(row.price_at_booking),
      preparationNotesAr: service.preparation_notes_ar,
      preparationNotesEn: service.preparation_notes_en,
    })
  }

  // `userId` is kept OUT of the DTO: the confirmation is the caller's own
  // booking, so echoing their id back adds nothing and PII stays minimal
  // (CLAUDE.md §8). The SMS step gets it separately.
  return {
    userId: data.user_id as string,
    confirmation: {
      bookingId: data.id,
      bookingRef: data.booking_ref,
      branchNameAr: branch.name_ar,
      branchAddressAr: branch.address_ar,
      isHospital,
      slotDate: slot.slot_date,
      slotTime: slot.slot_time,
      services,
      totalEgp: Number(data.total_amount),
      method: data.payment_method as PaymentMethod,
      confirmedAt: data.confirmed_at,
    },
  }
}

type BuiltConfirmation = NonNullable<Awaited<ReturnType<typeof buildConfirmation>>>

type SmsStatus = 'sent' | 'failed' | 'skipped'

/** Fires the confirmation SMS. NEVER throws — an SMS failure must not undo a
 * confirmed booking; the row is already committed and the reminder job will
 * still run the day before. */
async function sendConfirmationSms(built: BuiltConfirmation): Promise<SmsStatus> {
  const { confirmation, userId } = built
  try {
    const { data: user } = await admin.from('users').select('phone').eq('id', userId).single()
    if (!user?.phone) return 'failed'

    // Same predicate as core's computePreparationNotes: reassurance-only notes
    // are NOT preparation, and "empty means absent" (no note → no preparation
    // sentence at all).
    const prepNoteAr = formatPrepSmsNoteAr(confirmation.services)

    const message = buildConfirmationSmsAr({
      bookingRef: confirmation.bookingRef,
      branchNameAr: confirmation.branchNameAr,
      dateLabelAr: formatArabicDate(confirmation.slotDate),
      timeLabelAr: formatTimeShortAr(confirmation.slotTime),
      prepNoteAr,
    })

    // The static test numbers are not real phones. CI and dev must never text
    // them (ENGINEERING-WORKFLOW §6) — audited as 'skipped', not 'failed'.
    const skip = isStaticTestPhone(user.phone)
    let status: SmsStatus = 'skipped'
    if (!skip) {
      const response = await fetch(SEND_SMS_URL, {
        method: 'POST',
        headers: { ...JSON_HEADERS, Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ to: user.phone, message, type: 'booking_confirmation' }),
      })
      const result = await response.json().catch(() => ({ success: false }))
      status = result.success === true ? 'sent' : 'failed'
    }

    await admin.from('notifications').insert({
      booking_id: confirmation.bookingId,
      user_id: userId,
      type: 'booking_confirmation',
      channel: 'sms',
      recipient: user.phone,
      message,
      status,
      error_message: skip ? 'static test number — no real SMS in dev/CI' : null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
    return status
  } catch {
    return 'failed'
  }
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail('invalid_request', 405)

  // Caller identity comes from the patient's own JWT — never from the body.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (token.length === 0) return fail('not_your_booking', 401)
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  const callerId = authData?.user?.id
  if (authError || !callerId) return fail('not_your_booking', 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return fail('invalid_request', 400)
  }
  const request = parseRequest(body)
  if (request === null) return fail('invalid_request', 400)

  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select('id, user_id, slot_id, status')
    .eq('id', request.bookingId)
    .single()
  if (bookingError || !booking) return fail('booking_not_found', 404)
  if (booking.user_id !== callerId) return fail('not_your_booking', 403)

  // IDEMPOTENCY: already confirmed → return the confirmed state, don't re-run.
  // (PayTabs retries its IPN until it gets a 2xx.)
  if (booking.status === 'confirmed') {
    const built = await buildConfirmation(booking.id)
    if (built === null) return fail('server_error', 500)
    return new Response(
      JSON.stringify({
        success: true,
        alreadyConfirmed: true,
        confirmation: built.confirmation,
        // The SMS went out on the first settle — a retry must never re-send it.
        sms: 'skipped',
      }),
      { status: 200, headers: JSON_HEADERS },
    )
  }
  if (booking.status !== 'pending' && booking.status !== 'pending_payment') {
    return fail('booking_not_payable', 409)
  }

  // A failed payment leaves the booking pending and the hold untouched — the
  // patient retries or switches to cash. Nothing is written (no receipts or
  // refund flows in MVP, per spec).
  if (request.outcome === 'failure') return fail('payment_failed', 402)

  // DISPLAY PREDICATE = ENFORCEMENT PREDICATE (ENGINEERING-WORKFLOW §1.4): the
  // payment screen re-checks the hold on focus using this same rule, so the UI
  // can never offer a payment the server would refuse. confirm_booking itself
  // does NOT check holds — without this, a patient whose hold expired while
  // another patient took the slot could still consume remaining capacity.
  const { data: holds, error: holdError } = await admin
    .from('slot_holds')
    .select('id')
    .eq('slot_id', booking.slot_id)
    .eq('user_id', callerId)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
  if (holdError) return fail('server_error', 500)
  if (!holds || holds.length === 0) return fail('hold_expired', 409)

  // The atomic step: increments booked_count, flips status + payment_status,
  // inserts the payments row, deletes the hold — all in one transaction. The
  // hold DELETE also fires the realtime broadcast, so other patients viewing
  // this branch see the slot fill instantly (migration 20260726205901).
  const { data: rpcResult, error: rpcError } = await admin.rpc('confirm_booking', {
    p_booking_id: request.bookingId,
    p_payment_method: request.method,
    p_gateway_txn_id: request.providerRef,
    p_gateway_order_id: request.bookingId,
    p_gateway_response: request.providerPayload,
  })
  if (rpcError) return fail('server_error', 500)

  const result = rpcResult as { success: boolean; error?: string; current_status?: string }
  if (result.success !== true) {
    // Two concurrent settles for the same booking: the loser sees it already
    // processed. That is success, not an error.
    if (result.error === 'booking_already_processed' && result.current_status === 'confirmed') {
      const built = await buildConfirmation(request.bookingId)
      if (built === null) return fail('server_error', 500)
      return new Response(
        JSON.stringify({
          success: true,
          alreadyConfirmed: true,
          confirmation: built.confirmation,
          sms: 'skipped',
        }),
        { status: 200, headers: JSON_HEADERS },
      )
    }
    if (result.error === 'slot_unavailable') return fail('slot_unavailable', 409)
    if (result.error === 'booking_not_found') return fail('booking_not_found', 404)
    return fail('booking_not_payable', 409)
  }

  const built = await buildConfirmation(request.bookingId)
  if (built === null) return fail('server_error', 500)

  // Booking is COMMITTED at this point. The SMS is best-effort and can never
  // undo it — sendConfirmationSms swallows its own failures by design.
  const sms = await sendConfirmationSms(built)

  return new Response(
    JSON.stringify({
      success: true,
      alreadyConfirmed: false,
      confirmation: built.confirmation,
      sms,
    }),
    { status: 200, headers: JSON_HEADERS },
  )
})
