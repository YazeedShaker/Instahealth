import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

  let targetBranchId: string | null = null
  try { const body = await req.json(); targetBranchId = body?.branch_id ?? null } catch { /* no body */ }

  let query = supabase.from('branches').select('id, name_en').eq('is_active', true).eq('holiday_mode', false)
  if (targetBranchId) query = query.eq('id', targetBranchId)
  const { data: branches, error: branchError } = await query
  if (branchError) return new Response(JSON.stringify({ success: false, error: branchError.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  if (!branches?.length) return new Response(JSON.stringify({ success: true, message: 'No active branches', branches_processed: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  const today = new Date().toISOString().split('T')[0]
  const endDate = new Date(); endDate.setDate(endDate.getDate() + 30)
  const endDateStr = endDate.toISOString().split('T')[0]

  const results: Array<{ branch_id: string; name: string; slots_created: number; error?: string }> = []
  for (const branch of branches) {
    try {
      const { data, error } = await supabase.rpc('generate_branch_slots', { p_branch_id: branch.id, p_start_date: today, p_end_date: endDateStr })
      if (error) results.push({ branch_id: branch.id, name: branch.name_en, slots_created: 0, error: error.message })
      else results.push({ branch_id: branch.id, name: branch.name_en, slots_created: data as number })
    } catch (err) { results.push({ branch_id: branch.id, name: branch.name_en, slots_created: 0, error: String(err) }) }
  }

  const totalSlots = results.reduce((sum, r) => sum + r.slots_created, 0)
  return new Response(JSON.stringify({ success: true, branches_processed: branches.length, total_slots_created: totalSlots, date_range: { start: today, end: endDateStr }, results }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
