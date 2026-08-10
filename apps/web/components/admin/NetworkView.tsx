'use client'

import { toArabicDigits } from '@instahealth/core'
import { resolveTokenCss } from '@instahealth/design-tokens'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useRef, useState, useTransition } from 'react'

import { setCommissionRateAction } from '../../app/admin/providers-actions'
import {
  cairoToday,
  rateInForce,
  type AuditEntry,
  type ProviderDetail,
  type ProviderListRow,
} from '../../lib/network/providers'
import { Button } from '../ui/Button'

// A03 — «المزودون والفروع», built to `Admin - Providers and Branches.dc.html`
// (frames A, A2, A3).
//
// ⚠ THE RATE EDITOR IS THE POINT OF THIS SCREEN. Everything else here is
// maintenance; the rate is a clause in a signed agreement, and it is the number
// A02's statements multiply by. So it gets the consequential-confirm anatomy the
// frames give it: the old rate beside the new one, the date it starts, an
// explicit "issued statements are untouched" line, and a REQUIRED written-
// acknowledgment checkbox. The checkbox is a UI gate by design — the server
// enforces the date rule, which is the part a modified client could otherwise
// lie about.

function fmtDateAr(iso: string): string {
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

function StatusChip({ active }: { active: boolean }) {
  return (
    <span
      data-testid={active ? 'network-status-active' : 'network-status-inactive'}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold"
      style={{
        color: resolveTokenCss(active ? 'primary.700' : 'neutral.600'),
        background: resolveTokenCss(active ? 'info.bg' : 'neutral.100'),
        border: `1px solid ${resolveTokenCss(active ? 'primary.400' : 'neutral.300')}`,
      }}
    >
      {active ? '● نشط' : '◍ لم يُفعّل بعد'}
    </span>
  )
}

/** The shared audit panel — «سجل التغييرات». A04 and A05 reuse this shape, so
 *  it renders any {old,new} jsonb pair rather than knowing about rates. */
function AuditPanel({ entries, scope }: { entries: readonly AuditEntry[]; scope: string }) {
  const label = (key: string): string =>
    ({
      commission_percent: 'نسبة الاتفاق',
      name_ar: 'الاسم بالعربية',
      name_en: 'الاسم بالإنجليزية',
      is_active: 'حالة التفعيل',
      district: 'المنطقة',
      instahealth_slot_allocation: 'توزيع المواعيد',
      created: 'الإنشاء',
      effective_from: 'سريان من',
    })[key] ?? key

  const render = (v: unknown): string => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'boolean') return v ? 'نشط' : 'موقوف'
    return toArabicDigits(String(v))
  }

  return (
    <section
      data-testid="network-audit"
      className="flex flex-col gap-3 rounded-xl border border-ih-neutral-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[15px] font-extrabold text-ih-neutral-800">سجل التغييرات</h3>
          <span className="text-[11.5px] text-ih-neutral-500">{scope}</span>
        </div>
        <span className="shrink-0 text-[12px] text-ih-neutral-500">
          {toArabicDigits(String(entries.length))} تعديلات
        </span>
      </div>

      {entries.length === 0 ? (
        <p data-testid="network-audit-empty" className="text-[12.5px] text-ih-neutral-500">
          لا تعديلات بعد — أول تغيير يُسجَّل هنا باسمك وتاريخه.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {entries.map((e) => {
            const keys = [...new Set([...Object.keys(e.newValues), ...Object.keys(e.oldValues)])]
            return (
              <li
                key={e.id}
                data-testid="network-audit-entry"
                className="flex flex-col gap-1 border-b border-ih-neutral-100 pb-2.5 last:border-0"
              >
                {keys.map((k) => (
                  <span key={k} className="text-[12.5px] text-ih-neutral-700">
                    <strong className="font-bold">{label(k)}</strong>
                    {k in e.oldValues ? (
                      <>
                        {' '}
                        من <span className="font-semibold">{render(e.oldValues[k])}</span> إلى{' '}
                      </>
                    ) : (
                      ': '
                    )}
                    <span className="font-semibold text-ih-neutral-800">
                      {render(e.newValues[k])}
                    </span>
                  </span>
                ))}
                <span className="text-[11px] text-ih-neutral-500">
                  {fmtDateAr(e.changedAt)} · <span className="font-semibold">الإدارة</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-[11px] text-ih-neutral-500">السجل للقراءة فقط ولا يُحذف منه شيء.</p>
    </section>
  )
}

export function NetworkView({
  providers,
  detail,
}: {
  providers: readonly ProviderListRow[]
  detail: ProviderDetail | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const busy = useRef(false)
  const [errorAr, setErrorAr] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')

  const run = useCallback(
    (work: () => Promise<{ ok: boolean; errorAr: string | null }>) => {
      if (busy.current) return
      busy.current = true
      setErrorAr(null)
      startTransition(async () => {
        try {
          const r = await work()
          if (!r.ok) setErrorAr(r.errorAr)
          router.refresh()
        } finally {
          busy.current = false
        }
      })
    },
    [router],
  )

  const filtered = useMemo(() => {
    const q = query.trim()
    return providers.filter((p) => {
      if (status === 'active' && !p.isActive) return false
      if (status === 'inactive' && p.isActive) return false
      if (q === '') return true
      return (
        p.nameAr.includes(q) ||
        p.nameEn.toLowerCase().includes(q.toLowerCase()) ||
        p.districts.some((d) => d.includes(q))
      )
    })
  }, [providers, query, status])

  if (detail) {
    return (
      <ProviderDetailView
        detail={detail}
        isPending={isPending}
        errorAr={errorAr}
        run={run}
        onBack={() => router.push('/admin/providers')}
      />
    )
  }

  const totalBranches = providers.reduce((s, p) => s + p.branchCount, 0)
  const activeBranches = providers.reduce((s, p) => s + p.activeBranchCount, 0)

  return (
    <main data-testid="admin-network" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ih-neutral-200 bg-white px-6 py-3">
        <input
          data-testid="network-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث باسم المزود أو الفرع أو المنطقة"
          className="min-h-10 min-w-[280px] flex-1 rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[13.5px] text-ih-neutral-800"
        />
        <select
          data-testid="network-status-filter"
          aria-label="الحالة"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="min-h-10 shrink-0 rounded-lg border-[1.5px] border-ih-neutral-200 bg-white px-3 text-[13.5px] font-semibold text-ih-neutral-800"
        >
          <option value="all">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
        </select>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-6">
        <p className="text-[12px] text-ih-neutral-600">
          {toArabicDigits(String(providers.length))} مزودين ·{' '}
          {toArabicDigits(String(totalBranches))} فروع · {toArabicDigits(String(activeBranches))}{' '}
          فروع نشطة
        </p>

        <div className="flex items-center gap-2.5 rounded-lg border border-ih-primary-400 bg-ih-info-bg px-4 py-3">
          <span aria-hidden="true">ℹ</span>
          <span className="text-[12.5px] text-ih-primary-800">
            كل ما في هذه الشاشة تُديره الإدارة فقط — الاسم، ساعات العمل، توزيع المواعيد، الموقع،
            وحالة التفعيل مقفلة في بوابة الشركاء.
          </span>
        </div>

        <div className="overflow-x-auto">
          <div
            className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white shadow-sm"
            style={{ minWidth: 760 }}
          >
            <div
              className="grid items-center gap-2 border-b border-ih-neutral-200 bg-ih-neutral-50 px-4 py-2.5 text-[11.5px] font-bold text-ih-neutral-600"
              style={{ gridTemplateColumns: '1fr auto auto auto auto auto' }}
            >
              <span>المزود</span>
              <span>الفروع</span>
              <span>نسبة الاتفاق</span>
              <span>نسبة الفرع</span>
              <span>الحالة</span>
              <span>آخر تعديل</span>
            </div>

            {filtered.length === 0 ? (
              <p
                data-testid="network-empty"
                className="px-4 py-10 text-center text-[13px] text-ih-neutral-600"
              >
                لا مزود يطابق البحث.
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-testid="network-provider-row"
                  onClick={() => router.push(`/admin/providers?provider=${p.id}`)}
                  className="grid w-full items-center gap-2 border-b border-ih-neutral-100 px-4 py-3 text-start last:border-0 hover:bg-ih-neutral-50"
                  style={{ gridTemplateColumns: '1fr auto auto auto auto auto' }}
                >
                  <span className="flex flex-col">
                    <span className="text-[13.5px] font-bold text-ih-neutral-800">{p.nameAr}</span>
                    <span className="text-[11.5px] text-ih-neutral-500">
                      {p.districts.slice(0, 3).join(' · ') || '—'}
                    </span>
                  </span>
                  <span className="text-[13px] tabular-nums text-ih-neutral-700">
                    {toArabicDigits(String(p.branchCount))}
                  </span>
                  <span
                    data-testid="network-rate"
                    className="text-[13px] font-bold tabular-nums text-ih-neutral-800"
                  >
                    {p.currentPercent === null
                      ? '—'
                      : `${toArabicDigits(String(p.currentPercent))}٪`}
                  </span>
                  {/* Reserved for a branch-level override — not in v1. */}
                  <span className="text-[13px] text-ih-neutral-400">—</span>
                  <StatusChip active={p.isActive} />
                  <span className="text-[11.5px] text-ih-neutral-500">
                    {fmtDateAr(p.updatedAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <p className="text-[11.5px] leading-[1.7] text-ih-neutral-500">
          عمود «نسبة الفرع» محجوز لتجاوز نسبة العمولة على مستوى الفرع — غير مُفعّل في v1، ويظهر
          معطّلاً حتى يُقرّ.
        </p>
      </div>
    </main>
  )
}

function ProviderDetailView({
  detail,
  isPending,
  errorAr,
  run,
  onBack,
}: {
  detail: ProviderDetail
  isPending: boolean
  errorAr: string | null
  run: (w: () => Promise<{ ok: boolean; errorAr: string | null }>) => void
  onBack: () => void
}) {
  const today = cairoToday()
  const current = rateInForce(detail.rates, today)
  const [percent, setPercent] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Three futures the founder actually uses: the start of next month (the
  // common case — agreements change on a month boundary), tomorrow, and the
  // month after. All strictly future, so none can be refused by the server.
  const dateOptions = useMemo(() => {
    const [y, m] = today.split('-').map(Number)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const tomorrow = new Date(`${today}T00:00:00Z`)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const nextMonth = new Date(Date.UTC(y as number, m as number, 1))
    const monthAfter = new Date(Date.UTC(y as number, (m as number) + 1, 1))
    return [
      { value: iso(nextMonth), label: `${fmtDateAr(iso(nextMonth))} — بداية الشهر القادم` },
      { value: iso(tomorrow), label: `${fmtDateAr(iso(tomorrow))} — غداً` },
      { value: iso(monthAfter), label: fmtDateAr(iso(monthAfter)) },
    ]
  }, [today])
  const [acknowledged, setAcknowledged] = useState(false)

  const parsedPercent = Number(percent)
  const rateFormValid =
    percent.trim() !== '' &&
    Number.isFinite(parsedPercent) &&
    parsedPercent > 0 &&
    parsedPercent <= 100 &&
    effectiveFrom > today

  return (
    <main
      data-testid="admin-network-detail"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6"
    >
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <button
          type="button"
          data-testid="network-back"
          onClick={onBack}
          className="self-start text-[12.5px] text-ih-primary-600 hover:underline"
        >
          ◂ المزودون
        </button>

        {errorAr ? (
          <div
            role="alert"
            data-testid="network-error"
            className="rounded-lg border border-ih-error-bg bg-ih-error-bg px-4 py-3 text-[13px] font-semibold"
            style={{ color: '#991B1B' }}
          >
            {errorAr}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[20px] font-extrabold text-ih-neutral-800">{detail.nameAr}</h2>
          <StatusChip active={detail.isActive} />
          <span className="rounded-full border border-ih-neutral-200 bg-ih-neutral-100 px-3 py-1 text-[11.5px] font-semibold text-ih-neutral-600">
            🔓 تُدار من الإدارة — مقفلة للشريك
          </span>
        </div>

        {/* ── THE RATE EDITOR ─────────────────────────────────────────────── */}
        <section
          data-testid="network-rate-editor"
          className="flex flex-col gap-3 rounded-xl border border-ih-neutral-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-[15px] font-extrabold text-ih-neutral-800">نسبة الاتفاق</h3>
              <span className="text-[11.5px] text-ih-neutral-500">
                تحكم عمولة كل حجز بحسب تاريخ استحقاقه — إليها ترجع نسب صفوف الكشف
              </span>
            </div>
            <span
              data-testid="network-current-rate"
              className="rounded-full bg-ih-primary-50 px-3 py-1 text-[12.5px] font-bold text-ih-primary-700"
            >
              السارية الآن: {current === null ? '—' : `${toArabicDigits(String(current.percent))}٪`}
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-ih-neutral-600">
              النسبة الجديدة
              <input
                data-testid="network-rate-input"
                inputMode="decimal"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="min-h-10 w-28 rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[13.5px] font-bold text-ih-neutral-800"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-ih-neutral-600">
              سارية من تاريخ <span className="font-normal text-ih-neutral-500">(مطلوب)</span>
              {/* ⚠ A SELECT, NOT `<input type="date">`. The native picker renders
                  in the BROWSER's locale — it showed `mm/dd/yyyy` inside an
                  Arabic RTL panel, which is both wrong-looking and ambiguous
                  about which number is the month. The frame curates three
                  future dates instead, and curation is also the safer control:
                  every option it offers is one the server will accept. */}
              <select
                data-testid="network-rate-date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="min-h-10 rounded-lg border-[1.5px] border-ih-neutral-200 bg-white px-3 text-[13.5px] font-semibold text-ih-neutral-800"
              >
                <option value="">اختر تاريخاً…</option>
                {dateOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              size="md"
              variant="primary"
              data-testid="network-rate-save"
              disabled={!rateFormValid || isPending}
              onClick={() => {
                setAcknowledged(false)
                setConfirmOpen(true)
              }}
            >
              حفظ النسبة الجديدة
            </Button>
          </div>

          <p className="text-[11.5px] leading-[1.7] text-ih-neutral-500">
            ℹ لا يمكن أن يكون التاريخ في الماضي. الحجوزات التي استُحقت قبله تبقى بنسبتها القديمة إلى
            الأبد — والكشوف المُصدَرة لا تتأثر.
          </p>

          <div className="mt-1 flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-ih-neutral-700">تاريخ النسب</span>
            {detail.rates.map((r) => {
              const isCurrent = current !== null && r.effectiveFrom === current.effectiveFrom
              return (
                <div
                  key={r.effectiveFrom}
                  data-testid="network-rate-history-row"
                  className="flex flex-wrap items-center gap-2 text-[12.5px] text-ih-neutral-700"
                >
                  <span className="font-bold tabular-nums">
                    {toArabicDigits(String(r.percent))}٪
                  </span>
                  <span className="text-ih-neutral-500">من {fmtDateAr(r.effectiveFrom)}</span>
                  {isCurrent ? (
                    <span
                      data-testid="network-rate-current-chip"
                      className="rounded-full bg-ih-primary-50 px-2 py-0.5 text-[11px] font-bold text-ih-primary-700"
                    >
                      سارية
                    </span>
                  ) : r.effectiveFrom > today ? (
                    <span className="rounded-full bg-ih-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-ih-neutral-600">
                      تبدأ لاحقاً
                    </span>
                  ) : null}
                  {/* ⚠ The backfilled rows carry an English internal note. Raw,
                      it reads as debris in an Arabic panel — and it is actually
                      the LAUNCH BLOCKER, so it is surfaced as such, in the one
                      screen where it gets fixed. */}
                  {r.note?.startsWith('PLACEHOLDER') ? (
                    <span
                      data-testid="network-rate-placeholder"
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ color: '#92400E', background: resolveTokenCss('warning.bg') }}
                    >
                      نسبة مبدئية — أدخل النسبة المتفق عليها قبل أول كشف حقيقي
                    </span>
                  ) : r.note ? (
                    <span className="text-[11px] text-ih-neutral-500">{r.note}</span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── branches ────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2 rounded-xl border border-ih-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-[15px] font-extrabold text-ih-neutral-800">
            الفروع — {toArabicDigits(String(detail.branches.length))}
          </h3>
          {detail.branches.map((b) => (
            <div
              key={b.id}
              data-testid="network-branch-row"
              className="flex flex-wrap items-center gap-3 border-b border-ih-neutral-100 py-2 last:border-0"
            >
              <span className="flex-1 text-[13px] font-semibold text-ih-neutral-800">
                {b.nameAr}
              </span>
              <span className="text-[12px] text-ih-neutral-600">
                {toArabicDigits(String(b.allocation))} موعداً يومياً
              </span>
              <StatusChip active={b.isActive} />
            </div>
          ))}
        </section>

        <AuditPanel entries={detail.audit} scope="على مستوى المزود — يشمل النسبة" />
      </div>

      {/* ── the consequential confirm ─────────────────────────────────────── */}
      {confirmOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-8"
          style={{ background: 'rgba(2,20,27,0.5)' }}
        >
          <div
            data-testid="network-rate-confirm"
            role="dialog"
            aria-modal="true"
            className="w-[560px] max-w-full overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex flex-col gap-2 px-6 pt-5">
              <span className="text-[17px] font-extrabold text-ih-neutral-800">
                هذا يغيّر ما يدفعه {detail.nameAr} لإنستاهيلث
              </span>
              <span className="text-[13px] leading-[1.7] text-ih-neutral-600">
                من {fmtDateAr(effectiveFrom)} تُحسب عمولة كل حجز يستحق في ذلك التاريخ أو بعده بنسبة{' '}
                {toArabicDigits(percent)}٪ بدلاً من{' '}
                {current === null ? '—' : `${toArabicDigits(String(current.percent))}٪`}. أبلِغ
                الشريك قبل السريان — هذا بند في الاتفاق لا إعداد في النظام.
              </span>
            </div>

            <div className="m-6 overflow-hidden rounded-xl border border-ih-neutral-200">
              <div className="flex items-center justify-between gap-3 border-b border-ih-neutral-100 px-4 py-2.5">
                <span className="text-[12.5px] text-ih-neutral-600">
                  النسبة الحالية — تبقى للحجوزات قبل التاريخ
                </span>
                <span className="text-[13.5px] font-bold tabular-nums text-ih-neutral-500">
                  {current === null ? '—' : `${toArabicDigits(String(current.percent))}٪`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 bg-ih-primary-50 px-4 py-2.5">
                <span className="text-[12.5px] font-bold text-ih-primary-700">
                  النسبة الجديدة — من {fmtDateAr(effectiveFrom)}
                </span>
                <span className="text-[15px] font-extrabold tabular-nums text-ih-primary-700">
                  {toArabicDigits(percent)}٪
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-ih-neutral-100 px-4 py-2.5">
                <span className="text-[12.5px] text-ih-neutral-600">الكشوف المُصدَرة</span>
                <span className="text-[12.5px] font-semibold text-ih-neutral-700">
                  لا تتأثر — لا أثر رجعي
                </span>
              </div>
            </div>

            <label className="mx-6 flex items-start gap-2.5 text-[12.5px] text-ih-neutral-700">
              <input
                data-testid="network-rate-ack"
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5"
              />
              أكّدتُ النسبة الجديدة وتاريخ سريانها مع الشريك كتابةً.
            </label>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-ih-neutral-200 bg-ih-neutral-50 px-6 py-3.5">
              <Button size="md" variant="ghost" onClick={() => setConfirmOpen(false)}>
                إلغاء
              </Button>
              <Button
                size="md"
                variant="primary"
                data-testid="network-rate-confirm-submit"
                disabled={!acknowledged || isPending}
                onClick={() => {
                  setConfirmOpen(false)
                  run(async () => {
                    const r = await setCommissionRateAction(detail.id, parsedPercent, effectiveFrom)
                    if (r.ok) {
                      setPercent('')
                      setEffectiveFrom('')
                    }
                    return r
                  })
                }}
              >
                تثبيت {toArabicDigits(percent)}٪ من {fmtDateAr(effectiveFrom)}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
