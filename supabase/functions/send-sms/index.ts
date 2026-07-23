const VONAGE_API_KEY    = Deno.env.get('VONAGE_API_KEY')!
const VONAGE_API_SECRET = Deno.env.get('VONAGE_API_SECRET')!
const VONAGE_FROM       = Deno.env.get('VONAGE_FROM') ?? 'InstaHealth'

interface SendSmsRequest {
  to: string
  message: string
  type?: string
}

async function sendViaVonage(to: string, message: string) {
  const body = new URLSearchParams({
    api_key: VONAGE_API_KEY, api_secret: VONAGE_API_SECRET,
    to, from: VONAGE_FROM, text: message, type: 'unicode'
  })
  const response = await fetch('https://rest.nexmo.com/sms/json', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
  })
  const result = await response.json()
  const msg = result.messages?.[0]
  if (!msg || msg.status !== '0') return { success: false, error: msg?.['error-text'] ?? 'Unknown Vonage error' }
  return { success: true, message_id: msg['message-id'] }
}

function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('20')) return digits
  if (digits.startsWith('0')) return '2' + digits
  return '20' + digits
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  let body: SendSmsRequest
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) }
  if (!body.to || !body.message) return new Response(JSON.stringify({ error: 'to and message required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  const to = normalisePhone(body.to)
  if (!/^201[0-9]{9}$/.test(to)) return new Response(JSON.stringify({ error: 'Invalid Egyptian phone number', number: to }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  const result = await sendViaVonage(to, body.message)
  if (!result.success) return new Response(JSON.stringify({ success: false, error: result.error }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  return new Response(JSON.stringify({ success: true, message_id: result.message_id }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
