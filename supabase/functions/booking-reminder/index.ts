import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const SEND_SMS_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sms`
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function formatTimeArabic(time: string): string {
  const [hourStr, minStr] = time.split(':')
  const hour = parseInt(hourStr)
  const min = minStr ?? '00'
  const period = hour < 12 ? 'صباحاً' : 'مساءً'
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${hour12}:${min} ${period}`
}

async function sendSms(to: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(SEND_SMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ to, message, type: 'booking_reminder' })
    })
    const data = await res.json()
    return data.success === true
  } catch { return false }
}

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${SERVICE_KEY}`) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

  const now = new Date()
  const tomorrowEgypt = new Date(now)
  tomorrowEgypt.setUTCHours(tomorrowEgypt.getUTCHours() + 2)
  tomorrowEgypt.setUTCDate(tomorrowEgypt.getUTCDate() + 1)
  const tomorrowStr = tomorrowEgypt.toISOString().split('T')[0]

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, booking_ref, slot:slots!inner(slot_date, slot_time), branch:branches!inner(name_ar), user:users!inner(phone, sms_reminders), booking_services(branch_service:branch_services(service:services(preparation_notes_ar)))')
    .eq('status', 'confirmed')
    .eq('slot.slot_date', tomorrowStr)
    .eq('user.sms_reminders', true)

  if (error) return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })

  let sent = 0, failed = 0
  for (const booking of bookings ?? []) {
    const slot = Array.isArray(booking.slot) ? booking.slot[0] : booking.slot
    const branch = Array.isArray(booking.branch) ? booking.branch[0] : booking.branch
    const user = Array.isArray(booking.user) ? booking.user[0] : booking.user
    if (!user?.phone || !slot || !branch) continue
    const prepNote = booking.booking_services?.flatMap((bs: any) => bs.branch_service?.service?.preparation_notes_ar ?? [])?.find((n: string) => n && !n.includes('لا يشترط'))
    const timeAr = formatTimeArabic(slot.slot_time)
    const base = `تذكير: لديك موعد تحاليل غداً في ${branch.name_ar} الساعة ${timeAr}. رقم الحجز: ${booking.booking_ref}.`
    const message = (base + (prepNote ? ` ${prepNote}` : '')).substring(0, 140)
    const ok = await sendSms(user.phone, message)
    await supabase.from('notifications').insert({ booking_id: booking.id, type: 'reminder', channel: 'sms', recipient: user.phone, message, status: ok ? 'sent' : 'failed', sent_at: ok ? new Date().toISOString() : null })
    if (ok) sent++; else failed++
  }

  return new Response(JSON.stringify({ success: true, sent, failed, date: tomorrowStr }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
