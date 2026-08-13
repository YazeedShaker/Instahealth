'use client'

import {
  buildCommissionStatementCsv,
  formatPiastersEgpAr,
  formatStatementDayAr,
  formatStatementMonthAr,
  toArabicDigits,
  type CommissionStatementLine,
} from '@instahealth/core'
import {
  STATEMENT_BANNER,
  STATEMENT_BANNER_BASE,
  STATEMENT_CHIP_BASE,
  STATEMENT_STATUS_CHIP,
  STATEMENT_SUMMARY_CARD,
  STATEMENT_TABLE,
  resolveTokenCss,
  type StatementBannerTone,
  type StatementStatus,
} from '@instahealth/design-tokens'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState, useTransition, type ReactNode } from 'react'

import { issueStatementAction, transitionStatementAction } from '../../app/admin/commission-actions'
import type {
  CommissionStatementView as StatementView,
  StatementProvider,
} from '../../lib/commissions/statement'
import { Button } from '../ui/Button'

// A02 — «العمولات والفواتير», built to `Admin - Commission Statement.dc.html`
// (frames A–E).
//
// ⚠ THE ONE RULE THIS SCREEN EXISTS TO KEEP: every summary number must be
// reproducible from the rows below it. So the cards are rendered FROM the same
// line array the table renders — never from a separately-fetched aggregate.
// If they could disagree, one day they would, and this is the document a
// partner disputes.

function ChipStatus({ status }: { status: StatementStatus }) {
  const spec = STATEMENT_STATUS_CHIP[status]
  return (
    <span
      data-testid={`statement-status-${status}`}
      className="inline-flex shrink-0 items-center whitespace-nowrap"
      style={{
        gap: STATEMENT_CHIP_BASE.gap,
        padding: `${STATEMENT_CHIP_BASE.paddingY}px ${STATEMENT_CHIP_BASE.paddingX}px`,
        borderRadius: STATEMENT_CHIP_BASE.borderRadius,
        fontSize: STATEMENT_CHIP_BASE.fontSize,
        fontWeight: STATEMENT_CHIP_BASE.fontWeight,
        color: resolveTokenCss(spec.color),
        background: resolveTokenCss(spec.background),
        border: `${STATEMENT_CHIP_BASE.borderWidth}px solid ${resolveTokenCss(spec.borderColor)}`,
      }}
    >
      {spec.glyph ? <span aria-hidden="true">{spec.glyph}</span> : null}
      {spec.label}
    </span>
  )
}

function Banner({
  tone,
  title,
  body,
  action,
  testId,
}: {
  tone: StatementBannerTone
  title: string
  body: string
  action?: ReactNode
  testId: string
}) {
  const spec = STATEMENT_BANNER[tone]
  return (
    <div
      data-testid={testId}
      role={tone === 'changed' ? 'alert' : 'status'}
      className="flex shrink-0 flex-wrap items-center"
      style={{
        gap: STATEMENT_BANNER_BASE.gap,
        background: resolveTokenCss(spec.background),
        border: `${STATEMENT_BANNER_BASE.borderWidth}px solid ${resolveTokenCss(spec.borderColor)}`,
        borderRadius: STATEMENT_BANNER_BASE.borderRadius,
        padding: `${STATEMENT_BANNER_BASE.paddingY}px ${STATEMENT_BANNER_BASE.paddingX}px`,
      }}
    >
      {spec.glyph ? (
        <span aria-hidden="true" className="shrink-0" style={{ fontSize: 14 }}>
          {spec.glyph}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          style={{
            fontSize: STATEMENT_BANNER_BASE.titleSize,
            fontWeight: 700,
            color: resolveTokenCss(spec.color),
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: STATEMENT_BANNER_BASE.bodySize,
            lineHeight: 1.6,
            color: resolveTokenCss(spec.color),
          }}
        >
          {body}
        </span>
      </div>
      <div className="flex-1" />
      {action}
    </div>
  )
}

function SummaryCard({
  label,
  figure,
  suffix,
  footnote,
  emphasis = false,
  testId,
}: {
  label: string
  figure: string
  suffix?: string
  footnote: ReactNode
  emphasis?: boolean
  testId: string
}) {
  return (
    <div
      data-testid={testId}
      data-print="card"
      className="flex flex-col bg-white shadow-sm"
      style={{
        gap: 4,
        padding: `${STATEMENT_SUMMARY_CARD.paddingY}px ${STATEMENT_SUMMARY_CARD.paddingX}px`,
        borderRadius: STATEMENT_SUMMARY_CARD.borderRadius,
        border: `${STATEMENT_SUMMARY_CARD.borderWidth}px solid ${resolveTokenCss(STATEMENT_SUMMARY_CARD.borderColor)}`,
        borderTop: `${STATEMENT_SUMMARY_CARD.topRuleWidth}px solid ${resolveTokenCss(
          emphasis
            ? STATEMENT_SUMMARY_CARD.topRuleColorEmphasis
            : STATEMENT_SUMMARY_CARD.topRuleColor,
        )}`,
      }}
    >
      <span
        style={{
          fontSize: STATEMENT_SUMMARY_CARD.labelSize,
          fontWeight: 600,
          color: resolveTokenCss(emphasis ? 'primary.700' : 'neutral.600'),
        }}
      >
        {label}
      </span>
      <span
        className="tabular-nums"
        style={{
          fontSize: emphasis
            ? STATEMENT_SUMMARY_CARD.figureSizeEmphasis
            : STATEMENT_SUMMARY_CARD.figureSize,
          fontWeight: 800,
          lineHeight: 1.15,
          color: resolveTokenCss(emphasis ? 'primary.700' : 'neutral.800'),
        }}
      >
        {figure}
        {suffix ? (
          <span
            style={{
              fontSize: STATEMENT_SUMMARY_CARD.suffixSize,
              fontWeight: 600,
              color: resolveTokenCss(emphasis ? 'primary.600' : 'neutral.500'),
            }}
          >
            {' '}
            {suffix}
          </span>
        ) : null}
      </span>
      <span style={{ fontSize: STATEMENT_SUMMARY_CARD.footnoteSize }}>{footnote}</span>
    </div>
  )
}

const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: STATEMENT_TABLE.columns,
  gap: STATEMENT_TABLE.gap,
  alignItems: 'center',
  padding: `0 ${STATEMENT_TABLE.paddingX}px`,
}

function MethodChip({ method }: { method: 'cash' | 'prepaid' }) {
  const cash = method === 'cash'
  return (
    <span
      className="inline-flex items-center justify-self-start whitespace-nowrap"
      style={{
        gap: 4,
        fontSize: 11.5,
        fontWeight: 600,
        borderRadius: 9999,
        padding: '3px 10px',
        color: cash ? '#92400E' : resolveTokenCss('primary.700'),
        background: resolveTokenCss(cash ? 'accent.200' : 'primary.50'),
      }}
    >
      {cash ? 'نقداً بالفرع' : 'مدفوع مقدماً'}
    </span>
  )
}

export function CommissionStatementView({
  view,
  providers,
  months,
  selectedProviderId,
  selectedMonth,
  selectedVersion,
}: {
  view: StatementView
  providers: readonly StatementProvider[]
  months: readonly string[]
  selectedProviderId: string
  selectedMonth: string
  selectedVersion: number | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showExcluded, setShowExcluded] = useState(false)
  const [reissueOpen, setReissueOpen] = useState(false)
  const [errorAr, setErrorAr] = useState<string | null>(null)
  // ⚠ A REF, not state. §9's law: a second click arriving before React
  // re-renders reads the stale flag and sails straight through — and here that
  // would issue two versions of the same statement.
  const busy = useRef(false)

  const provider = providers.find((p) => p.id === selectedProviderId)
  const totals = view.statement ? view.statement.totals : view.liveTotals
  const counted = view.lines.filter((l) => !l.excluded)
  const status: StatementStatus = view.statement ? view.statement.status : 'draft'
  const isSettled = status === 'settled'
  const isSuperseded = status === 'superseded'

  // DISPLAY = ENFORCEMENT. These booleans mirror `transition_statement`'s guards
  // exactly, so the screen can never offer an action the RPC will refuse.
  const canSend = !isSuperseded && (view.statement === null || status === 'issued')
  const canSettle = !isSuperseded && status === 'sent'
  const canReissue =
    !isSettled && !isSuperseded && view.statement !== null && view.changedSinceIssue

  const navigate = useCallback(
    (next: { provider?: string; month?: string; version?: string | null }) => {
      const params = new URLSearchParams()
      params.set('provider', next.provider ?? selectedProviderId)
      params.set('month', next.month ?? selectedMonth)
      const version =
        next.version === undefined ? (selectedVersion?.toString() ?? null) : next.version
      if (version !== null) params.set('version', version)
      router.push(`/admin/commissions?${params.toString()}`)
    },
    [router, selectedProviderId, selectedMonth, selectedVersion],
  )

  const run = useCallback(
    (work: () => Promise<{ ok: boolean; errorAr: string | null }>) => {
      if (busy.current) return
      busy.current = true
      setErrorAr(null)
      startTransition(async () => {
        try {
          const result = await work()
          if (!result.ok) setErrorAr(result.errorAr)
          // ⚠ The refresh is AWAITED inside the transition, so `isPending`
          // spans the write AND the confirming re-read. Lowering it when the
          // write resolves would re-enable the button during the window where
          // the screen still shows the pre-action state (§9 ③).
          router.refresh()
        } finally {
          busy.current = false
        }
      })
    },
    [router],
  )

  const markSent = () =>
    run(async () => {
      // On a never-issued month the founder's single «تحديد كمُرسلة» must both
      // FREEZE the numbers and mark them sent — the frames show one button, and
      // the snapshot has to be taken at the moment the partner receives it.
      if (view.statement === null) {
        const issued = await issueStatementAction(selectedProviderId, selectedMonth)
        if (!issued.ok) return issued
      }
      const target = view.statement?.id
      if (target === undefined) {
        // The id only exists after the issue above, so re-read on the server.
        router.refresh()
        return { ok: true, errorAr: null }
      }
      return transitionStatementAction(target, 'sent')
    })

  const downloadCsv = useCallback(() => {
    const csv = buildCommissionStatementCsv({
      providerNameAr: provider?.nameAr ?? '',
      month: view.month,
      version: view.statement?.version ?? null,
      status: view.statement?.status ?? 'draft',
      issuedAt: view.statement?.issuedAt ?? null,
      // The export always carries EVERY row, including the excluded ones, even
      // when they are hidden on screen. The design's annotation is explicit:
      // «لا حذف صامت».
      lines: view.lines,
      totals,
    })
    // A BOM, so Excel opens Arabic as UTF-8 instead of mojibake.
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `commission-${provider?.nameAr ?? 'partner'}-${view.month}${
      view.statement ? `-v${view.statement.version}` : '-draft'
    }.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [provider, view, totals])

  const rowsToRender: readonly CommissionStatementLine[] = showExcluded ? view.lines : counted

  return (
    <main
      data-testid="admin-commissions"
      data-print="page"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {/* ── scope bar ────────────────────────────────────────────────────── */}
      <div
        data-print="hide"
        className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ih-neutral-200 bg-white px-6 py-3"
      >
        <select
          data-testid="statement-provider"
          aria-label="الشريك"
          value={selectedProviderId}
          onChange={(e) => navigate({ provider: e.target.value, version: null })}
          className="min-h-10 min-w-[220px] shrink-0 rounded-lg border-[1.5px] border-ih-neutral-200 bg-white px-3 text-[13.5px] font-semibold text-ih-neutral-800"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nameAr}
            </option>
          ))}
        </select>

        <select
          data-testid="statement-month"
          aria-label="الشهر"
          value={selectedMonth}
          onChange={(e) => navigate({ month: e.target.value, version: null })}
          className="min-h-10 min-w-[150px] shrink-0 rounded-lg border-[1.5px] border-ih-neutral-200 bg-white px-3 text-[13.5px] font-semibold text-ih-neutral-800"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {formatStatementMonthAr(m)}
            </option>
          ))}
        </select>

        {view.versions.length > 1 ? (
          <select
            data-testid="statement-version"
            aria-label="الإصدار"
            value={String(view.statement?.version ?? '')}
            onChange={(e) => navigate({ version: e.target.value })}
            className="min-h-10 shrink-0 rounded-lg border-[1.5px] border-ih-primary-400 bg-ih-primary-50 px-3 text-[13px] font-bold text-ih-primary-700"
          >
            {view.versions.map((v) => (
              <option key={v.id} value={String(v.version)}>
                {`الإصدار ${toArabicDigits(String(v.version))}`}
                {v.status === 'superseded' ? ' — ملغاة' : ' — الحالي'}
              </option>
            ))}
          </select>
        ) : null}

        <div className="flex min-w-0 flex-col gap-px border-e border-ih-neutral-200 pe-3">
          <span className="truncate text-[13px] font-bold text-ih-neutral-800">
            {provider?.nameAr} — {formatStatementMonthAr(view.month)}
          </span>
          <span className="whitespace-nowrap text-[11.5px] text-ih-neutral-500">
            {toArabicDigits(String(provider?.branchCount ?? 0))} فروع
            {view.statement ? ` · الإصدار ${toArabicDigits(String(view.statement.version))}` : ''}
          </span>
        </div>

        <div className="flex-1" />
        <ChipStatus status={status} />

        {isSettled ? (
          <span
            data-testid="statement-locked"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-ih-neutral-200 bg-ih-neutral-100 px-3 py-1.5 text-[12px] font-semibold text-ih-neutral-500"
          >
            🔒 لا تعديل بعد التسوية
          </span>
        ) : null}

        {canSend ? (
          <Button
            size="sm"
            variant="outline"
            data-testid="statement-mark-sent"
            disabled={isPending}
            onClick={markSent}
          >
            {view.statement
              ? `تحديد كمُرسلة — النسخة ${toArabicDigits(String(view.statement.version))}`
              : 'تحديد كمُرسلة'}
          </Button>
        ) : null}

        {canSettle && view.statement ? (
          <Button
            size="sm"
            variant="outline"
            data-testid="statement-mark-settled"
            disabled={isPending}
            onClick={() => run(() => transitionStatementAction(view.statement!.id, 'settled'))}
          >
            تحديد كمُسوّاة
          </Button>
        ) : null}

        <div className="flex shrink-0 gap-2 border-e border-ih-neutral-200 pe-3">
          <Button size="sm" variant="ghost" data-testid="statement-csv" onClick={downloadCsv}>
            ⤓ CSV
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="statement-print"
            onClick={() => window.print()}
          >
            ⎙ طباعة
          </Button>
        </div>
      </div>

      {/* ── body ─────────────────────────────────────────────────────────── */}
      <div data-print="scroll" className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-6">
        {/* A header the paper needs and the screen already has in its chrome. */}
        {/* ⚠ THE PAPER'S OWN HEADER. SPEC-A02 requires the export to carry the
            issue stamp, the version and the excluded-bookings note — «both
            carrying issue stamp, version, and the excluded-...». Version and
            status were here; the ISSUE STAMP was not, so a printed statement
            could not be told apart from another issue of the same version. */}
        <div data-print="title" className="hidden">
          <strong>
            كشف العمولة — {provider?.nameAr} — {formatStatementMonthAr(view.month)}
            {view.statement
              ? ` — الإصدار ${toArabicDigits(String(view.statement.version))} — ${STATEMENT_STATUS_CHIP[status].label}`
              : ' — مسودة'}
          </strong>
          {view.statement?.issuedAt ? (
            <span data-testid="print-issue-stamp" style={{ display: 'block', fontSize: 11 }}>
              صدر في {formatStamp(view.statement.issuedAt)}
            </span>
          ) : null}
        </div>

        {errorAr ? (
          <Banner
            tone="changed"
            title="تعذّر تنفيذ الإجراء"
            body={errorAr}
            testId="statement-error"
          />
        ) : null}

        {/* issue stamps — the two dash-dates in draft, per frame A */}
        <div className="flex shrink-0 flex-wrap items-center gap-5">
          <span className="text-[12px] text-ih-neutral-600" data-testid="statement-issued-stamp">
            {view.statement ? (
              <>
                أُصدرت في:{' '}
                <span className="font-bold text-ih-neutral-800">
                  {formatStamp(view.statement.issuedAt)}
                </span>
              </>
            ) : (
              <span className="text-ih-neutral-500">
                لم تُصدر بعد — الأرقام تتغير مع كل زيارة تُتَمّ حتى الإصدار
              </span>
            )}
          </span>
          <div className="flex-1" />
          <span className="text-[12px] text-ih-neutral-600" data-testid="statement-sent-stamp">
            أُرسلت في:{' '}
            <span className="font-bold text-ih-neutral-800">
              {formatStamp(view.statement?.sentAt ?? null)}
            </span>
          </span>
          <span className="text-[12px] text-ih-neutral-600" data-testid="statement-settled-stamp">
            تمت التسوية في:{' '}
            <span className="font-bold text-ih-primary-700">
              {formatStamp(view.statement?.settledAt ?? null)}
            </span>
          </span>
        </div>

        {isSuperseded ? (
          <Banner
            tone="superseded"
            title={`النسخة ${toArabicDigits(String(view.statement?.version ?? 0))} — ملغاة بإصدار أحدث`}
            body="محفوظة كما أُرسلت — قابلة للعرض والتصدير للسجل، وغير قابلة للتعديل"
            testId="statement-superseded-banner"
            action={
              <Button size="sm" variant="ghost" onClick={() => navigate({ version: null })}>
                عرض النسخة الحالية
              </Button>
            }
          />
        ) : null}

        {canReissue ? (
          <Banner
            tone="changed"
            title="تغيّرت البيانات بعد الإصدار — الأرقام أدناه لا تطابق الكشف المُرسل"
            body={`الفرق ${formatPiastersEgpAr(view.deltaCommissionPiasters)} ج.م عمولة. لا نعدّل كشفاً مُرسلاً — أصدر نسخة جديدة ليحصل الشريك على مستند مطابق.`}
            testId="statement-changed-banner"
            action={
              <Button
                size="sm"
                variant="destructive"
                data-testid="statement-reissue"
                disabled={isPending}
                onClick={() => setReissueOpen(true)}
              >
                إعادة إصدار
              </Button>
            }
          />
        ) : null}

        {view.creditForward ? (
          <Banner
            tone="creditForward"
            title="وصل تغيير بعد التسوية — يُرحّل إلى الشهر التالي"
            body={`الكشف المُسوّى لا يُعاد إصداره ولا يُعدَّل — يظهر الفرق (${formatPiastersEgpAr(view.deltaCommissionPiasters)} ج.م) كسطر «مُرحّل» في كشف الشهر التالي.`}
            testId="statement-credit-forward"
          />
        ) : null}

        {/* summary cards */}
        <div
          className="grid shrink-0"
          style={{
            gridTemplateColumns: `repeat(${STATEMENT_SUMMARY_CARD.columns}, minmax(0, 1fr))`,
            gap: STATEMENT_SUMMARY_CARD.gap,
          }}
        >
          <SummaryCard
            testId="statement-card-gmv"
            label="إجمالي المبيعات المحتسبة"
            figure={formatPiastersEgpAr(totals.gmvPiasters)}
            suffix="ج.م"
            footnote={
              <span className="text-ih-neutral-600">
                {`مجموع ${toArabicDigits(String(counted.length))} صفاً في الجدول أدناه`}
              </span>
            }
          />
          <SummaryCard
            testId="statement-card-count"
            label="حجوزات محتسبة"
            figure={toArabicDigits(String(totals.commissionableCount))}
            suffix={`من ${toArabicDigits(String(totals.commissionableCount + totals.excludedCount))}`}
            footnote={<MethodSplit lines={counted} />}
          />
          <SummaryCard
            testId="statement-card-commission"
            emphasis
            label={isSettled ? 'العمولة المُسوّاة' : 'العمولة المستحقة'}
            figure={formatPiastersEgpAr(totals.commissionTotalPiasters)}
            suffix="ج.م"
            footnote={<RatesFootnote lines={counted} />}
          />
        </div>

        {/* the amber exclusion strip — never hidden, per the ruling */}
        {totals.excludedCount > 0 ? (
          <Banner
            tone="excluded"
            title={`${toArabicDigits(String(totals.excludedCount))} حجوزات أُغلقت تلقائياً — غير محتسبة (${formatPiastersEgpAr(totals.excludedAmountPiasters)} ج.م)`}
            body="أغلقها النظام بعد مهلة الـ٢٤ ساعة دون تأكيد وصول — لا عمولة عليها، وليست جزءاً من أي رقم أعلاه"
            testId="statement-excluded-banner"
            action={
              <button
                type="button"
                data-testid="statement-toggle-excluded"
                data-print="hide"
                onClick={() => setShowExcluded((v) => !v)}
                className="shrink-0 whitespace-nowrap text-[12px] font-bold underline"
                style={{ color: '#92400E' }}
              >
                {showExcluded ? 'إخفاء من الجدول' : 'إظهار في الجدول'}
              </button>
            }
          />
        ) : null}

        {/* ── the table ─────────────────────────────────────────────────── */}
        {/* VIEW-01's backstop: a dense table gets a scrolling wrapper so no
            column is ever unreachable, at any zoom. */}
        <div className="shrink-0 overflow-x-auto">
          <div
            data-print="card"
            className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white shadow-sm"
            style={{ minWidth: STATEMENT_TABLE.minWidth }}
          >
            <div
              data-print="head"
              style={{
                ...GRID,
                paddingTop: 10,
                paddingBottom: 10,
                background: resolveTokenCss('neutral.50'),
                borderBottom: `1px solid ${resolveTokenCss('neutral.200')}`,
                fontSize: STATEMENT_TABLE.headerFontSize,
                fontWeight: 700,
                color: resolveTokenCss('neutral.600'),
              }}
            >
              <span>المرجع</span>
              <span>تاريخ الحجز</span>
              <span>الطريقة</span>
              <span>تاريخ الاستحقاق</span>
              <span className="text-start">المبلغ</span>
              <span className="text-start">النسبة</span>
              <span className="text-start">العمولة</span>
            </div>

            {rowsToRender.length === 0 ? (
              <div
                data-testid="statement-empty"
                className="flex flex-col items-center gap-1 px-4 py-10 text-center"
              >
                <span className="text-[14px] font-bold text-ih-neutral-700">
                  لا حجوزات محتسبة في هذا الشهر
                </span>
                <span className="text-[12px] text-ih-neutral-500">
                  لم تُتمّ أي زيارة نقدية ولم يُسجَّل أي دفع مسبق في{' '}
                  {formatStatementMonthAr(view.month)} — الإجمالي صفر، وهذا رقم حقيقي وليس خطأً.
                </span>
              </div>
            ) : (
              rowsToRender.map((line) => (
                <div
                  key={line.bookingRef}
                  data-testid={line.excluded ? 'statement-row-excluded' : 'statement-row'}
                  data-print="row"
                  style={{
                    ...GRID,
                    minHeight: STATEMENT_TABLE.rowMinHeight,
                    borderBottom: `1px solid ${resolveTokenCss('neutral.100')}`,
                    fontSize: STATEMENT_TABLE.rowFontSize,
                    color: resolveTokenCss(line.excluded ? 'neutral.500' : 'neutral.700'),
                    background: line.excluded ? resolveTokenCss('neutral.50') : undefined,
                  }}
                >
                  <span
                    dir="ltr"
                    className="text-end font-atkinson text-[12.5px] font-bold"
                    style={{
                      unicodeBidi: 'isolate',
                      color: resolveTokenCss(line.excluded ? 'neutral.500' : 'primary.700'),
                      textDecoration: line.excluded ? 'line-through' : undefined,
                    }}
                  >
                    {line.bookingRef}
                  </span>
                  <span
                    className="tabular-nums"
                    style={{ textDecoration: line.excluded ? 'line-through' : undefined }}
                  >
                    {formatStatementDayAr(line.bookingDate)}
                  </span>

                  {line.excluded ? (
                    <span
                      className="inline-flex items-center justify-self-start whitespace-nowrap"
                      style={{
                        gridColumn: 'span 2',
                        gap: 5,
                        fontSize: 11.5,
                        fontWeight: 700,
                        borderRadius: 9999,
                        padding: '3px 10px',
                        color: '#92400E',
                        background: resolveTokenCss('warning.bg'),
                        border: '1px solid rgba(217,119,6,0.35)',
                      }}
                    >
                      أُغلقت تلقائياً — غير محتسبة
                    </span>
                  ) : (
                    <>
                      <MethodChip method={line.method} />
                      <div className="flex flex-col">
                        <span className="tabular-nums text-[12.5px] font-semibold text-ih-neutral-800">
                          {line.eventDate === null ? '—' : formatStatementDayAr(line.eventDate)}
                        </span>
                        <span className="text-[10.5px] text-ih-neutral-500">
                          {line.eventKind === 'payment' ? 'تاريخ الدفع' : 'تاريخ الإتمام'}
                        </span>
                      </div>
                    </>
                  )}

                  <span
                    className="text-start text-[13.5px] font-semibold tabular-nums text-ih-neutral-800"
                    style={{ textDecoration: line.excluded ? 'line-through' : undefined }}
                  >
                    {formatPiastersEgpAr(line.amountPiasters)}
                  </span>
                  <span className="text-start text-[12.5px] tabular-nums text-ih-neutral-600">
                    {line.ratePercent === null
                      ? '—'
                      : `${toArabicDigits(String(line.ratePercent))}٪`}
                  </span>
                  <span className="text-start text-[13.5px] font-bold tabular-nums text-ih-neutral-800">
                    {line.excluded ? '—' : formatPiastersEgpAr(line.commissionPiasters)}
                  </span>
                </div>
              ))
            )}

            {/* the total row — the number the partner is paid */}
            <div
              data-testid="statement-total-row"
              data-print="row"
              style={{
                ...GRID,
                minHeight: STATEMENT_TABLE.totalMinHeight,
                background: resolveTokenCss('primary.50'),
                fontSize: 13.5,
              }}
            >
              <span
                style={{
                  gridColumn: 'span 4',
                  fontWeight: 800,
                  color: resolveTokenCss('primary.700'),
                }}
              >
                {isSettled ? 'الإجمالي المُسوّى' : 'الإجمالي المحتسب'} —{' '}
                {toArabicDigits(String(totals.commissionableCount))} حجوزات
                {totals.excludedCount > 0 ? (
                  <span className="font-semibold text-ih-neutral-600">
                    {' '}
                    ({toArabicDigits(String(totals.excludedCount))} مستثناة غير محتسبة)
                  </span>
                ) : null}
              </span>
              <span
                className="text-start tabular-nums"
                style={{ fontWeight: 800, color: resolveTokenCss('primary.700') }}
              >
                {formatPiastersEgpAr(totals.gmvPiasters)}
              </span>
              <span />
              <span
                className="text-start tabular-nums"
                style={{ fontSize: 16, fontWeight: 800, color: resolveTokenCss('primary.700') }}
              >
                {formatPiastersEgpAr(totals.commissionTotalPiasters)}
              </span>
            </div>
          </div>
        </div>

        <span className="shrink-0 text-[11.5px] leading-[1.7] text-ih-neutral-500">
          النسبة المعروضة في كل صف هي النسبة السارية في تاريخ استحقاقه — تاريخ الدفع للمدفوع مقدماً،
          وتاريخ إتمام الزيارة للنقدي. الحجوزات التي أغلقها النظام تلقائياً لا تدخل أي مجموع.
        </span>
      </div>

      {/* ── re-issue confirmation, per frame B ───────────────────────────── */}
      {reissueOpen && view.statement ? (
        <div
          data-print="hide"
          className="absolute inset-0 z-[60] flex items-center justify-center p-8"
          style={{ background: 'rgba(2,20,27,0.5)' }}
        >
          <div
            data-testid="statement-reissue-dialog"
            role="dialog"
            aria-modal="true"
            className="w-[520px] max-w-full overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex flex-col gap-2 px-6 pt-5">
              <span className="text-[17px] font-extrabold text-ih-neutral-800">
                إصدار النسخة {toArabicDigits(String(view.statement.version + 1))} من كشف{' '}
                {formatStatementMonthAr(view.month)}؟
              </span>
              <span className="text-[13px] leading-[1.7] text-ih-neutral-600">
                تبقى النسخة {toArabicDigits(String(view.statement.version))} محفوظة ومعلّمة «نسخة
                ملغاة» — لن تُعدّل ولن تُحذف. تُصدر النسخة الجديدة بتاريخ إصدار جديد وتعود حالة
                الإرسال إلى «مسودة» حتى ترسلها للشريك.
              </span>
            </div>
            <div className="m-6 overflow-hidden rounded-xl border border-ih-neutral-200">
              <div className="flex items-center justify-between gap-3 border-b border-ih-neutral-100 px-4 py-2.5">
                <span className="text-[12.5px] text-ih-neutral-600">
                  النسخة {toArabicDigits(String(view.statement.version))} — الحالية
                </span>
                <span className="text-[13.5px] font-bold tabular-nums text-ih-neutral-500 line-through">
                  {formatPiastersEgpAr(view.statement.totals.commissionTotalPiasters)} ج.م
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 bg-ih-primary-50 px-4 py-2.5">
                <span className="text-[12.5px] font-bold text-ih-primary-700">
                  النسخة {toArabicDigits(String(view.statement.version + 1))} —{' '}
                  {toArabicDigits(String(view.liveTotals.commissionableCount))} حجوزات محتسبة
                </span>
                <span className="text-[15px] font-extrabold tabular-nums text-ih-primary-700">
                  {formatPiastersEgpAr(view.liveTotals.commissionTotalPiasters)} ج.م
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-ih-neutral-200 bg-ih-neutral-50 px-6 py-3.5">
              <Button size="md" variant="ghost" onClick={() => setReissueOpen(false)}>
                إلغاء
              </Button>
              <Button
                size="md"
                variant="destructive"
                data-testid="statement-reissue-confirm"
                disabled={isPending}
                onClick={() => {
                  setReissueOpen(false)
                  run(() => issueStatementAction(selectedProviderId, selectedMonth))
                }}
              >
                إصدار النسخة {toArabicDigits(String(view.statement.version + 1))}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function formatStamp(iso: string | null): string {
  if (iso === null) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const formatted = new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
  return formatted
}

/** «٤ مدفوعة مقدماً · ٤ نقداً» — and it COLLAPSES in cash-only reality rather
 *  than saying «٠ مدفوعة مقدماً», per frame E's annotation. */
function MethodSplit({ lines }: { lines: readonly CommissionStatementLine[] }) {
  const cash = lines.filter((l) => l.method === 'cash').length
  const prepaid = lines.length - cash

  if (prepaid === 0) {
    return (
      <span className="text-ih-neutral-600">
        كلها نقداً بالفرع — العمولة تُستحق عند إتمام الزيارة
      </span>
    )
  }
  if (cash === 0) {
    return (
      <span className="text-ih-neutral-600">كلها مدفوعة مقدماً — العمولة تُستحق عند الدفع</span>
    )
  }
  return (
    <span className="text-ih-neutral-600">
      {toArabicDigits(String(prepaid))} مدفوعة مقدماً · {toArabicDigits(String(cash))} نقداً
    </span>
  )
}

/** The mixed-rate footnote appears ONLY when more than one rate is in play —
 *  a single-rate month must not carry a note about blending. */
function RatesFootnote({ lines }: { lines: readonly CommissionStatementLine[] }) {
  const rates = [...new Set(lines.map((l) => l.ratePercent).filter((r): r is number => r !== null))]
  if (rates.length === 0) return <span className="text-ih-neutral-600">لا عمولة مستحقة</span>
  if (rates.length === 1) {
    return (
      <span className="text-ih-neutral-600">
        النسبة السارية: {toArabicDigits(String(rates[0]))}٪
      </span>
    )
  }
  return (
    <span className="text-ih-neutral-600" data-testid="statement-mixed-rates">
      نسب سارية: {rates.map((r) => `${toArabicDigits(String(r))}٪`).join(' و ')} — إجمالي مركّب
    </span>
  )
}
