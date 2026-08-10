'use client'

import {
  BRANCH_OFFERING_AR,
  SERVICE_STATUS_AR,
  bulkPriceNudgeMessageAr,
  formatPriceRangeEgpAr,
  nextServiceStatuses,
  priceNudgeMessageAr,
  resolveNudgeChannel,
  toArabicDigits,
  type ServiceStatus,
} from '@instahealth/core'
import { resolveTokenCss } from '@instahealth/design-tokens'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useTransition } from 'react'

import {
  createServiceAction,
  linkServiceToBranchAction,
  setCategoryActiveAction,
  setServiceStatusAction,
  updateServiceAction,
  type CatalogActionResult,
} from '../../app/admin/catalog-actions'
import type {
  AdminCategory,
  CatalogCounts,
  CatalogRow,
  CategoryPreview,
  ServiceDetail,
  StatusPreview,
} from '../../lib/catalog/services'
import { Button } from '../ui/Button'
import { AdminHeader } from './AdminHeader'
import { ConsequentialConfirm, type ConfirmRow } from './ConsequentialConfirm'

// A04 — «كتالوج الخدمات», built to `Admin - Service Catalog.dc.html`
// (frames A, B, C, D) plus the category-flip confirm, which has NO frame and is
// composed from the established consequential-confirm anatomy under the
// component-contract exception (founder ruling 2026-08-10).
//
// ⚠ THE DIVISION THIS SCREEN EXISTS TO MAKE VISIBLE: the admin owns the
// DEFINITION and the LINK, the partner owns the PRICE. Every price on this page
// is read-only and says so; «أضف فرعاً» creates the pairing row and nothing
// else. That is why the price table has no inputs at all.

const CAIRO_DATETIME = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

function fmtWhen(iso: string | null): string {
  if (iso === null) return '—'
  return CAIRO_DATETIME.format(new Date(iso))
}

const TAT_CHOICES = [12, 24, 48, 72] as const

function StatusChip({ status }: { status: ServiceStatus }) {
  const vocabulary = SERVICE_STATUS_AR[status]
  const tone =
    status === 'published'
      ? { color: 'primary.700', background: 'success.bg', border: 'success.bg' }
      : status === 'suspended'
        ? { color: 'warning.text', background: 'warning.bg', border: 'warning.border' }
        : { color: 'neutral.600', background: 'neutral.100', border: 'neutral.200' }

  return (
    <span
      data-testid={`catalog-status-${status}`}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold"
      style={{
        color: resolveTokenCss(tone.color),
        background: resolveTokenCss(tone.background),
        border: `1px solid ${resolveTokenCss(tone.border)}`,
      }}
    >
      {vocabulary.chipAr}
    </span>
  )
}

/** The frame's list header — «١٤ خدمة · ١١ منشورة · ٢ مسودة · ١ موقوفة». */
function countsLine(counts: CatalogCounts): string {
  return [
    `${toArabicDigits(String(counts.total))} خدمة`,
    `${toArabicDigits(String(counts.published))} منشورة`,
    `${toArabicDigits(String(counts.draft))} مسودة`,
    `${toArabicDigits(String(counts.suspended))} موقوفة`,
  ].join(' · ')
}

export function CatalogView({
  services,
  counts,
  categories,
  detail,
  statusPreview,
  categoryPreview,
}: {
  services: readonly CatalogRow[]
  counts: CatalogCounts
  categories: readonly AdminCategory[]
  detail: ServiceDetail | null
  statusPreview: StatusPreview | null
  categoryPreview: CategoryPreview | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorAr, setErrorAr] = useState<string | null>(null)
  // ⚠ A ref, not state: a second click arriving before React re-renders reads a
  // stale flag and sails straight through (§9③).
  const inFlight = useRef(false)

  const run = (action: () => Promise<CatalogActionResult>, after?: () => void) => {
    if (inFlight.current) return
    inFlight.current = true
    setErrorAr(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) setErrorAr(result.errorAr)
        else {
          after?.()
          router.refresh()
        }
      } finally {
        inFlight.current = false
      }
    })
  }

  if (detail !== null) {
    return (
      <ServiceDetailScreen
        detail={detail}
        categories={categories}
        statusPreview={statusPreview}
        isPending={isPending}
        errorAr={errorAr}
        run={run}
        onBack={() => router.push('/admin/catalog')}
      />
    )
  }

  return (
    <CatalogListScreen
      services={services}
      counts={counts}
      categories={categories}
      categoryPreview={categoryPreview}
      isPending={isPending}
      errorAr={errorAr}
      run={run}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// A · the list
// ═══════════════════════════════════════════════════════════════════════════
function CatalogListScreen({
  services,
  counts,
  categories,
  categoryPreview,
  isPending,
  errorAr,
  run,
}: {
  services: readonly CatalogRow[]
  counts: CatalogCounts
  categories: readonly AdminCategory[]
  categoryPreview: CategoryPreview | null
  isPending: boolean
  errorAr: string | null
  run: (action: () => Promise<CatalogActionResult>, after?: () => void) => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingCategory, setPendingCategory] = useState<AdminCategory | null>(null)

  // Name OR code — «ابحث باسم الخدمة أو رمزها».
  const visible = useMemo(
    () =>
      services.filter((service) => {
        const needle = query.trim().toLowerCase()
        const matchesQuery =
          needle === '' ||
          service.nameAr.toLowerCase().includes(needle) ||
          service.nameEn.toLowerCase().includes(needle) ||
          (service.code ?? '').toLowerCase().includes(needle)
        const matchesCategory = categoryFilter === '' || service.categoryId === categoryFilter
        const matchesStatus = statusFilter === '' || service.status === statusFilter
        return matchesQuery && matchesCategory && matchesStatus
      }),
    [services, query, categoryFilter, statusFilter],
  )

  return (
    <>
      <AdminHeader title="كتالوج الخدمات" displayName="مؤسِّس" subtitle={countsLine(counts)} />

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ih-neutral-200 bg-white px-6 py-3">
        <input
          data-testid="catalog-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث باسم الخدمة أو رمزها"
          aria-label="ابحث باسم الخدمة أو رمزها"
          className="min-h-[40px] min-w-[220px] flex-1 rounded-lg border-[1.5px] border-ih-neutral-200 px-3.5 text-[13.5px] text-ih-neutral-800"
        />
        <select
          data-testid="catalog-filter-category"
          aria-label="التصنيف"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="min-h-[40px] min-w-[150px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[13.5px] font-semibold text-ih-neutral-800"
        >
          <option value="">كل التصنيفات</option>
          {categories.map((category) => (
            <option key={category.categoryId} value={category.categoryId}>
              {category.nameAr}
            </option>
          ))}
        </select>
        <select
          data-testid="catalog-filter-status"
          aria-label="الحالة"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="min-h-[40px] min-w-[140px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[13.5px] font-semibold text-ih-neutral-800"
        >
          <option value="">كل الحالات</option>
          <option value="published">منشورة</option>
          <option value="draft">مسودة</option>
          <option value="suspended">موقوفة</option>
        </select>
        <Button size="sm" data-testid="catalog-new" onClick={() => setCreateOpen(true)}>
          + خدمة جديدة
        </Button>
      </div>

      <main data-testid="admin-catalog" className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-3">
          {errorAr !== null ? (
            <p
              data-testid="catalog-error"
              role="alert"
              className="rounded-lg px-3.5 py-2.5 text-[12.5px]"
              style={{
                background: resolveTokenCss('warning.bg'),
                color: resolveTokenCss('warning.text'),
              }}
            >
              {errorAr}
            </p>
          ) : null}

          <div
            className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5"
            style={{
              background: resolveTokenCss('info.bg'),
              border: `1px solid ${resolveTokenCss('primary.400')}`,
            }}
          >
            <span aria-hidden="true" className="shrink-0 text-[14px]">
              ℹ
            </span>
            <span
              className="text-[12.5px] leading-[1.6]"
              style={{ color: resolveTokenCss('primary.800') }}
            >
              الإدارة تُعرِّف الخدمة: اسمها، تصنيفها، ملاحظة التحضير، ونشرها. الشريك يُسعِّرها في
              فروعه — الأسعار هنا للقراءة فقط. الخدمة لا تظهر في فرع بلا سعر مُسجَّل.
            </span>
          </div>

          <CategoryStrip
            categories={categories}
            onFlip={(category) => {
              setPendingCategory(category)
              // Ask the server for the network-wide numbers. The dialog will not
              // render a CTA until they arrive.
              router.replace(
                `/admin/catalog?category=${category.categoryId}&categoryTo=${!category.isActive}`,
              )
            }}
          />

          {services.length === 0 ? (
            <EmptyCatalog onCreate={() => setCreateOpen(true)} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-ih-neutral-200 bg-white shadow-sm">
              <table data-testid="catalog-table" className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-ih-neutral-200 bg-ih-neutral-50 text-[11.5px] font-bold text-ih-neutral-600">
                    <th className="px-4 py-2.5 text-start">الخدمة</th>
                    <th className="px-4 py-2.5 text-start">التصنيف</th>
                    <th className="px-4 py-2.5 text-start">فروع مُسعِّرة</th>
                    <th className="px-4 py-2.5 text-start">نطاق السعر</th>
                    <th className="px-4 py-2.5 text-start">تحضير</th>
                    <th className="px-4 py-2.5 text-start">الحالة</th>
                    <th className="px-4 py-2.5 text-start">آخر تعديل</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((service) => (
                    <tr
                      key={service.serviceId}
                      data-testid="catalog-row"
                      tabIndex={0}
                      role="link"
                      onClick={() => router.push(`/admin/catalog?service=${service.serviceId}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          router.push(`/admin/catalog?service=${service.serviceId}`)
                        }
                      }}
                      className="cursor-pointer border-b border-ih-neutral-100 text-[13px] text-ih-neutral-700 hover:bg-ih-neutral-50"
                    >
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <span aria-hidden="true">{service.categoryIcon ?? '🧪'}</span>
                          <span className="font-bold text-ih-neutral-800">{service.nameAr}</span>
                          {service.code !== null ? (
                            <span dir="ltr" className="font-mono text-[11px] text-ih-neutral-500">
                              {service.code}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] text-ih-neutral-600">
                        {service.categoryNameAr}
                        {!service.categoryIsActive ? (
                          <span
                            data-testid="catalog-category-off"
                            className="ms-1.5 whitespace-nowrap rounded-full px-2 py-[2px] text-[10.5px] font-bold"
                            style={{
                              color: resolveTokenCss('warning.text'),
                              background: resolveTokenCss('warning.bg'),
                            }}
                          >
                            تصنيف غير مفعّل
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums">
                        {toArabicDigits(String(service.pricedBranchCount))}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {formatPriceRangeEgpAr(service.minPriceEgp, service.maxPriceEgp)}
                      </td>
                      <td className="px-4 py-2.5">
                        {service.hasPreparationNote ? (
                          <span
                            className="whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
                            style={{
                              color: resolveTokenCss('primary.800'),
                              background: '#FBFCE8',
                              border: '1px solid rgba(240,243,189,0.9)',
                            }}
                          >
                            ✓ ملاحظة
                          </span>
                        ) : (
                          <span className="text-ih-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusChip status={service.status} />
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-ih-neutral-500">
                        {fmtWhen(service.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length === 0 ? (
                <p data-testid="catalog-no-matches" className="p-6 text-[13px] text-ih-neutral-600">
                  لا خدمة تطابق البحث أو المرشِّحات.
                </p>
              ) : null}
            </div>
          )}

          <p className="text-[11.5px] leading-[1.7] text-ih-neutral-500">
            تجميع الخدمات في حِزَم (تحليل شامل بسعر واحد) ونسخ التسعير بين الفروع — مؤجَّلان لما بعد
            v1، ولا يظهر لهما مدخل هنا.
          </p>
        </div>
      </main>

      {createOpen ? (
        <ServiceForm
          categories={categories}
          isPending={isPending}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(values) =>
            run(
              () => createServiceAction(values),
              () => setCreateOpen(false),
            )
          }
        />
      ) : null}

      {pendingCategory !== null ? (
        <CategoryConfirm
          category={pendingCategory}
          preview={categoryPreview}
          isPending={isPending}
          onCancel={() => {
            setPendingCategory(null)
            router.replace('/admin/catalog')
          }}
          onConfirm={() =>
            run(
              () => setCategoryActiveAction(pendingCategory.categoryId, !pendingCategory.isActive),
              () => setPendingCategory(null),
            )
          }
        />
      ) : null}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// The category strip — THE LAUNCH SWITCH.
//
// ⚠ NO FRAME EXISTS FOR THIS. Composed from the drawn card + confirm anatomy
// per the founder ruling. It sits on the list because that is where the founder
// already reads «كل التصنيفات», and because flipping one is a network-wide
// commercial act rather than a property of any single service.
// ═══════════════════════════════════════════════════════════════════════════
function CategoryStrip({
  categories,
  onFlip,
}: {
  categories: readonly AdminCategory[]
  onFlip: (category: AdminCategory) => void
}) {
  // A category nobody has any service in cannot be launched into anything, so
  // it is not offered — it would be a switch with no circuit behind it.
  const relevant = categories.filter((category) => category.totalServices > 0)
  if (relevant.length === 0) return null

  return (
    <section
      data-testid="catalog-categories"
      className="flex flex-col gap-2.5 rounded-xl border border-ih-neutral-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[14.5px] font-bold text-ih-neutral-800">التصنيفات — مفتاح الإطلاق</h2>
        <span className="text-[11.5px] text-ih-neutral-500">
          تفعيل تصنيف يفتحه للمرضى في كل الشبكة دفعة واحدة
        </span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {relevant.map((category) => (
          <li key={category.categoryId}>
            <button
              type="button"
              data-testid="catalog-category-toggle"
              onClick={() => onFlip(category)}
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
              style={{
                color: resolveTokenCss(category.isActive ? 'primary.700' : 'neutral.600'),
                background: resolveTokenCss(category.isActive ? 'success.bg' : 'neutral.100'),
                borderColor: resolveTokenCss(category.isActive ? 'success.bg' : 'neutral.200'),
              }}
            >
              <span aria-hidden="true">{category.icon ?? '🧪'}</span>
              <span>{category.nameAr}</span>
              <span className="tabular-nums opacity-80">
                {toArabicDigits(String(category.publishedServices))} منشورة
              </span>
              <span className="font-bold">{category.isActive ? '● مفعّل' : '○ غير مفعّل'}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CategoryConfirm({
  category,
  preview,
  isPending,
  onCancel,
  onConfirm,
}: {
  category: AdminCategory
  preview: CategoryPreview | null
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const activating = !category.isActive

  // ⚠ The numbers come from `preview_category_activation`, never from the row
  // the founder clicked — the A03 rule that the dialog's numbers ARE the
  // function's numbers. Until the preview lands the CTA has nothing truthful to
  // say, so it says it is loading rather than guessing.
  if (preview === null) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-8"
        style={{ background: 'rgba(2,20,27,0.5)' }}
      >
        <div
          data-testid="catalog-category-confirm-loading"
          className="rounded-3xl bg-white px-8 py-6 text-[13px] text-ih-neutral-600 shadow-2xl"
        >
          يحسب أثر هذا التغيير على الشبكة…
        </div>
      </div>
    )
  }

  const rows: ConfirmRow[] = activating
    ? [
        {
          label: 'خدمات منشورة تُصبح قابلة للحجز فوراً',
          value: `${toArabicDigits(String(preview.publishedServices))} خدمة`,
          tone: 'good',
          emphasise: true,
        },
        {
          label: 'عند مزودين',
          value: `${toArabicDigits(String(preview.affectedProviders))} مزود · ${toArabicDigits(String(preview.affectedBranches))} فرع`,
          tone: 'good',
        },
        {
          label: 'مسودات داخل التصنيف — لن تظهر',
          value: `${toArabicDigits(String(preview.draftServices))} خدمة`,
          tone: 'warn',
        },
        {
          label: 'الخدمات بلا سعر في فرع',
          value: 'لا تظهر في ذلك الفرع حتى يُسعِّرها الشريك',
          tone: 'warn',
        },
      ]
    : [
        {
          label: 'خدمات تختفي من بحث المرضى فوراً',
          value: `${toArabicDigits(String(preview.publishedServices))} خدمة`,
          tone: 'warn',
          emphasise: true,
        },
        {
          label: 'عبر الشبكة',
          value: `${toArabicDigits(String(preview.affectedProviders))} مزود · ${toArabicDigits(String(preview.affectedBranches))} فرع`,
          tone: 'warn',
        },
        {
          label: 'حجوزات قائمة لا تتأثر',
          value: `${toArabicDigits(String(preview.outstandingBookings))} حجزاً — تُخدَم وتُحاسَب`,
          tone: 'good',
        },
        { label: 'الأسعار وملاحظات التحضير', value: 'تبقى كما هي', tone: 'neutral' },
      ]

  return (
    <ConsequentialConfirm
      testId="catalog-category-confirm"
      title={
        activating
          ? `تفعيل «${preview.nameAr}» يفتحه للمرضى في كل الشبكة`
          : `إيقاف «${preview.nameAr}» يخفيه عن المرضى في كل الشبكة`
      }
      body={
        activating
          ? 'هذا مفتاح الإطلاق: كل خدمة منشورة داخل هذا التصنيف تصبح ظاهرة وقابلة للحجز في اللحظة نفسها، عند كل شريك سجّل لها سعراً. الخدمات التي ما زالت مسودة، أو بلا سعر في فرع، لا تظهر هناك حتى يتغيّر ذلك.'
          : 'تختفي خدمات هذا التصنيف من بحث المرضى وصفحات الفروع فوراً، ويُرفَض أي حجز جديد لها. لا يُحذف شيء: الأسعار وملاحظات التحضير وحالة كل خدمة تبقى، والحجوزات القائمة تُخدَم كما هي.'
      }
      rows={rows}
      acknowledgement={
        activating
          ? 'أفهم أن هذا يفتح التصنيف للمرضى في كل الشبكة.'
          : 'أفهم أن خدمات هذا التصنيف تختفي من التطبيق فوراً، وأن الحجوزات القائمة تبقى ويجب أن تُخدَم.'
      }
      confirmLabel={
        activating
          ? `تفعيل ${preview.nameAr} في ${toArabicDigits(String(preview.affectedBranches))} فرعاً`
          : `إيقاف ${preview.nameAr} في كل الشبكة`
      }
      confirmTestId="catalog-category-confirm-submit"
      pending={isPending}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

function EmptyCatalog({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      data-testid="catalog-empty"
      className="flex flex-col items-center gap-3 rounded-xl border border-ih-neutral-200 bg-white p-12 text-center shadow-sm"
    >
      <span aria-hidden="true" className="text-[30px]">
        🧪
      </span>
      <span className="text-[17px] font-extrabold text-ih-neutral-800">الكتالوج فارغ</span>
      <span className="max-w-[480px] text-[13px] leading-[1.7] text-ih-neutral-600">
        عرِّف أول خدمة: اسمها بالعربية والإنجليزية، تصنيفها، وملاحظة التحضير. تبقى مسودة حتى
        يُسعِّرها الشركاء وتنشرها أنت.
      </span>
      <Button size="md" data-testid="catalog-empty-new" onClick={onCreate}>
        + خدمة جديدة
      </Button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// The definition form — create and edit share it, because they validate the
// same shape and `validate_service_definition` is one function server-side.
// ═══════════════════════════════════════════════════════════════════════════
interface DefinitionValues {
  nameAr: string
  nameEn: string
  code: string
  categoryId: string
  preparationNotesAr: string
  preparationNotesEn: string
  tatHours: number
}

function ServiceForm({
  categories,
  initial,
  isPending,
  onCancel,
  onSubmit,
}: {
  categories: readonly AdminCategory[]
  initial?: Partial<DefinitionValues>
  isPending: boolean
  onCancel: () => void
  onSubmit: (values: DefinitionValues) => void
}) {
  const [values, setValues] = useState<DefinitionValues>({
    nameAr: initial?.nameAr ?? '',
    nameEn: initial?.nameEn ?? '',
    code: initial?.code ?? '',
    categoryId: initial?.categoryId ?? categories[0]?.categoryId ?? '',
    preparationNotesAr: initial?.preparationNotesAr ?? '',
    preparationNotesEn: initial?.preparationNotesEn ?? '',
    tatHours: initial?.tatHours ?? 24,
  })

  const set = <K extends keyof DefinitionValues>(key: K, value: DefinitionValues[K]) =>
    setValues((previous) => ({ ...previous, [key]: value }))

  const ready =
    values.nameAr.trim() !== '' && values.nameEn.trim() !== '' && values.categoryId !== ''

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-8"
      style={{ background: 'rgba(2,20,27,0.5)' }}
    >
      <div
        data-testid="catalog-service-form"
        role="dialog"
        aria-modal="true"
        className="max-h-full w-[620px] max-w-full overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex flex-col gap-2 px-6 pt-5">
          <span className="text-[17px] font-extrabold text-ih-neutral-800">خدمة جديدة</span>
          <span className="text-[13px] leading-[1.7] text-ih-neutral-600">
            تُنشأ كمسودة ولا تظهر للمرضى. تُربط تلقائياً بكل فروع الشبكة بلا سعر — يُسعِّرها
            الشركاء، ثم تنشرها أنت.
          </span>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="grid grid-cols-[1fr_1fr_150px] gap-3.5">
            <Field label="الاسم بالعربية">
              <input
                data-testid="catalog-form-name-ar"
                value={values.nameAr}
                onChange={(event) => set('nameAr', event.target.value)}
                className="min-h-[44px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[14px]"
              />
            </Field>
            <Field label="الاسم بالإنجليزية">
              <input
                dir="ltr"
                data-testid="catalog-form-name-en"
                value={values.nameEn}
                onChange={(event) => set('nameEn', event.target.value)}
                className="min-h-[44px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-start text-[14px]"
              />
            </Field>
            <Field label="الرمز">
              <input
                dir="ltr"
                data-testid="catalog-form-code"
                value={values.code}
                placeholder="CBC-01"
                onChange={(event) => set('code', event.target.value.toUpperCase())}
                className="min-h-[44px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-start font-mono text-[14px]"
              />
            </Field>
          </div>

          <div className="grid grid-cols-[220px_1fr] gap-3.5">
            <Field label="التصنيف">
              <select
                data-testid="catalog-form-category"
                value={values.categoryId}
                onChange={(event) => set('categoryId', event.target.value)}
                className="min-h-[44px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[14px]"
              >
                {categories.map((category) => (
                  <option key={category.categoryId} value={category.categoryId}>
                    {category.nameAr}
                    {category.isActive ? '' : ' — غير مفعّل'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="موعد ظهور النتيجة (يظهر للمريض كمعلومة، لا وعد طبي)">
              {/* A curated select, not free text — every option it offers is one
                  the server will accept. Same lesson A03 learned when a native
                  date input rendered mm/dd/yyyy inside an Arabic panel. */}
              <select
                data-testid="catalog-form-tat"
                value={values.tatHours}
                onChange={(event) => set('tatHours', Number(event.target.value))}
                className="min-h-[44px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[14px]"
              >
                {TAT_CHOICES.map((hours) => (
                  <option key={hours} value={hours}>
                    خلال {toArabicDigits(String(hours))} ساعة من الزيارة
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="ملاحظة التحضير — تصل المريض في ٣ مواضع">
            <textarea
              data-testid="catalog-form-prep"
              value={values.preparationNotesAr}
              maxLength={200}
              onChange={(event) => set('preparationNotesAr', event.target.value)}
              className="min-h-[92px] rounded-lg border-[1.5px] border-ih-neutral-200 p-3 text-[14px] leading-[1.7]"
            />
            <span className="text-[11.5px] text-ih-neutral-500">
              {toArabicDigits(String(values.preparationNotesAr.length))} حرفاً من ٢٠٠ — تُعرض كما هي
              بلا اختصار
            </span>
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ih-neutral-200 bg-ih-neutral-50 px-6 py-3.5">
          <Button size="md" variant="ghost" onClick={onCancel} disabled={isPending}>
            إلغاء
          </Button>
          <Button
            size="md"
            data-testid="catalog-form-submit"
            disabled={!ready || isPending}
            onClick={() =>
              onSubmit({
                ...values,
                nameAr: values.nameAr.trim(),
                nameEn: values.nameEn.trim(),
                code: values.code.trim(),
              })
            }
          >
            إنشاء كمسودة
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-ih-neutral-700">{label}</span>
      {children}
    </label>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// B · the service detail
// ═══════════════════════════════════════════════════════════════════════════
function ServiceDetailScreen({
  detail,
  categories,
  statusPreview,
  isPending,
  errorAr,
  run,
  onBack,
}: {
  detail: ServiceDetail
  categories: readonly AdminCategory[]
  statusPreview: StatusPreview | null
  isPending: boolean
  errorAr: string | null
  run: (action: () => Promise<CatalogActionResult>, after?: () => void) => void
  onBack: () => void
}) {
  const router = useRouter()
  const { service, pricing, audit } = detail
  const [editing, setEditing] = useState(false)
  const [confirmTo, setConfirmTo] = useState<ServiceStatus | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)

  // Exactly one next state exists from anywhere (core: nextServiceStatuses),
  // but the array index is still `| undefined` to the compiler — default to
  // the only transition that is always legal rather than asserting.
  const nextStatus: ServiceStatus = nextServiceStatuses(service.status)[0] ?? 'published'

  const bulkChannel = useMemo(() => {
    if (pricing.unpricedNames.length === 0) return null
    // The bulk nudge has no single branch to address, so it uses the first
    // unpriced branch's contact — one message naming them all, which is what
    // the frame's footer button promises.
    const first = pricing.branches.find((branch) => branch.state === 'unpriced')
    if (first === undefined) return null
    return resolveNudgeChannel(
      { staffEmail: null, whatsapp: first.whatsapp, phone: first.phone },
      `تسعيرة مطلوبة — ${service.nameAr}`,
      bulkPriceNudgeMessageAr(service.nameAr, pricing.unpricedNames),
    )
  }, [pricing, service.nameAr])

  return (
    <>
      <AdminHeader
        title={service.nameAr}
        displayName="مؤسِّس"
        subtitle={`${SERVICE_STATUS_AR[service.status].meaningAr}${service.code === null ? '' : ` · ${service.code}`}`}
      />

      <main data-testid="admin-catalog-detail" className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-4">
          <button
            type="button"
            data-testid="catalog-back"
            onClick={onBack}
            className="w-fit text-[12.5px] text-ih-primary-600 hover:underline"
          >
            ◂ كتالوج الخدمات
          </button>

          {errorAr !== null ? (
            <p
              data-testid="catalog-error"
              role="alert"
              className="rounded-lg px-3.5 py-2.5 text-[12.5px]"
              style={{
                background: resolveTokenCss('warning.bg'),
                color: resolveTokenCss('warning.text'),
              }}
            >
              {errorAr}
            </p>
          ) : null}

          {!service.categoryIsActive ? (
            <p
              data-testid="catalog-detail-category-off"
              className="rounded-lg px-3.5 py-2.5 text-[12.5px] leading-[1.6]"
              style={{
                background: resolveTokenCss('warning.bg'),
                color: resolveTokenCss('warning.text'),
              }}
            >
              تصنيف «{service.categoryNameAr}» غير مفعّل — حتى لو نشرتَ هذه الخدمة، لن تظهر للمرضى
              حتى تُفعِّل التصنيف من صفحة الكتالوج.
            </p>
          ) : null}

          {/* ── التعريف ─────────────────────────────────────────────────── */}
          <section className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ih-neutral-200 px-4.5 py-3.5">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[14.5px] font-bold text-ih-neutral-800">تعريف الخدمة</h2>
                <span className="text-[11.5px] text-ih-neutral-600">
                  الاسم كما يقرأه المريض في البحث والحجز والتأكيد
                </span>
              </div>
              <span
                className="whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-bold text-white"
                style={{ background: '#023449' }}
              >
                🔓 تُدار من الإدارة — مقفلة للشريك
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 p-4.5 text-[13px] md:grid-cols-4">
              <Detail label="الاسم بالعربية" value={service.nameAr} />
              <Detail label="الاسم بالإنجليزية" value={service.nameEn} ltr />
              <Detail label="الرمز" value={service.code ?? '—'} ltr />
              <Detail label="التصنيف" value={service.categoryNameAr} />
              <Detail
                label="موعد ظهور النتيجة"
                value={
                  service.defaultTatHours === null
                    ? '—'
                    : `خلال ${toArabicDigits(String(service.defaultTatHours))} ساعة`
                }
              />
              <Detail label="آخر تعديل" value={fmtWhen(service.updatedAt)} />
            </dl>
            <div className="flex justify-end border-t border-ih-neutral-200 bg-ih-neutral-50 px-4.5 py-3">
              <Button size="sm" data-testid="catalog-edit" onClick={() => setEditing(true)}>
                تعديل التعريف
              </Button>
            </div>
          </section>

          {/* ── ملاحظة التحضير + معاينة المريض ──────────────────────────── */}
          <section className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ih-neutral-200 px-4.5 py-3.5">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[14.5px] font-bold text-ih-neutral-800">ملاحظة التحضير</h2>
                <span className="text-[11.5px] text-ih-neutral-600">
                  تظهر عند اختيار الخدمة، في صفحة التأكيد، وفي رسالة التذكير
                </span>
              </div>
              <span className="whitespace-nowrap rounded-full border border-ih-neutral-200 bg-ih-neutral-100 px-3 py-1 text-[11.5px] font-bold text-ih-neutral-600">
                تصل المريض في ٣ مواضع
              </span>
            </div>
            <div className="grid gap-4 p-4.5 md:grid-cols-[minmax(0,1fr)_320px]">
              <p
                data-testid="catalog-prep-text"
                className="whitespace-pre-wrap text-[14px] leading-[1.7] text-ih-neutral-800"
              >
                {service.preparationNotesAr ?? 'لا ملاحظة تحضير لهذه الخدمة.'}
              </p>
              {/* «كما يراها المريض» — the cream callout, rendered from the SAME
                  string the patient app renders, so the preview cannot drift. */}
              <div className="flex flex-col gap-2">
                <span className="text-[11.5px] font-bold text-ih-neutral-600">
                  كما يراها المريض
                </span>
                <div
                  data-testid="catalog-prep-preview"
                  className="flex gap-2.5 rounded-xl p-3.5"
                  style={{ background: '#FBFCE8', border: '1px solid rgba(240,243,189,0.9)' }}
                >
                  <span aria-hidden="true" className="shrink-0 text-[15px]">
                    🧪
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span
                      className="text-[12.5px] font-bold"
                      style={{ color: resolveTokenCss('primary.800') }}
                    >
                      قبل زيارتك
                    </span>
                    <span
                      className="text-[12.5px] leading-[1.7]"
                      style={{ color: resolveTokenCss('primary.800') }}
                    >
                      {service.preparationNotesAr ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── الأسعار في الفروع ───────────────────────────────────────── */}
          <section className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ih-neutral-200 px-4.5 py-3.5">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[14.5px] font-bold text-ih-neutral-800">
                  الأسعار في الفروع — {toArabicDigits(String(pricing.branchCount))} فرعاً مرتبطاً
                </h2>
                <span className="text-[11.5px] text-ih-neutral-600">
                  {toArabicDigits(String(pricing.pricedCount))} فروع مُسعِّرة ·{' '}
                  <span className="font-bold" style={{ color: resolveTokenCss('warning.text') }}>
                    {toArabicDigits(String(pricing.unpricedCount))} بلا سعر — لن تظهر عندها الخدمة
                  </span>
                </span>
              </div>
              <span
                className="whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-bold"
                style={{
                  color: resolveTokenCss('primary.700'),
                  background: resolveTokenCss('primary.50'),
                  border: `1px solid ${resolveTokenCss('primary.400')}`,
                }}
              >
                🔒 يُسعِّرها الشريك — قراءة فقط
              </span>
            </div>

            <div className="overflow-x-auto">
              <table
                data-testid="catalog-price-table"
                className="w-full min-w-[720px] border-collapse"
              >
                <thead>
                  <tr className="border-b border-ih-neutral-200 bg-ih-neutral-50 text-[11.5px] font-bold text-ih-neutral-600">
                    <th className="px-4 py-2.5 text-start">الفرع</th>
                    <th className="px-4 py-2.5 text-start">المزود</th>
                    <th className="px-4 py-2.5 text-start">السعر</th>
                    <th className="px-4 py-2.5 text-start">آخر تحديث سعر</th>
                    <th className="px-4 py-2.5 text-start" />
                  </tr>
                </thead>
                <tbody>
                  {pricing.branches.map((branch) => {
                    const channel =
                      branch.state === 'unpriced'
                        ? resolveNudgeChannel(
                            { staffEmail: null, whatsapp: branch.whatsapp, phone: branch.phone },
                            `تسعيرة مطلوبة — ${service.nameAr}`,
                            priceNudgeMessageAr(service.nameAr, branch.branchNameAr),
                          )
                        : null
                    return (
                      <tr
                        key={branch.branchId}
                        data-testid="catalog-price-row"
                        className="border-b border-ih-neutral-100 text-[13px] text-ih-neutral-700"
                        style={{
                          background:
                            branch.state === 'unpriced' ? 'rgba(254,243,199,0.35)' : undefined,
                        }}
                      >
                        <td className="px-4 py-2.5 font-semibold text-ih-neutral-800">
                          {branch.branchNameAr}
                        </td>
                        <td className="px-4 py-2.5 text-[12.5px] text-ih-neutral-600">
                          {branch.providerNameAr}
                        </td>
                        <td className="px-4 py-2.5">
                          {branch.state === 'live' ? (
                            <span className="font-bold tabular-nums text-ih-neutral-800">
                              {toArabicDigits(String(Math.round(branch.priceEgp ?? 0)))} ج.م
                            </span>
                          ) : (
                            <span
                              data-testid={`catalog-offering-${branch.state}`}
                              className="whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
                              style={{
                                color: resolveTokenCss('warning.text'),
                                background: resolveTokenCss('warning.bg'),
                                border: `1px solid ${resolveTokenCss('warning.border')}`,
                              }}
                            >
                              {BRANCH_OFFERING_AR[branch.state]}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-ih-neutral-500">
                          {fmtWhen(branch.pricedAt)}
                        </td>
                        <td className="px-4 py-2.5">
                          {channel !== null ? (
                            <a
                              data-testid="catalog-nudge"
                              href={channel.href}
                              className="whitespace-nowrap text-[12px] font-bold text-ih-primary-600 underline"
                            >
                              {channel.labelAr}
                            </a>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-ih-neutral-200 bg-ih-neutral-50 px-4.5 py-3">
              <span className="flex-1 text-[11.5px] leading-[1.6] text-ih-neutral-600">
                لا تُعدَّل الأسعار من هنا — التسعير من صلاحية الشريك في بوابته. تعديل الإدارة للسعر
                مباشرة مؤجَّل لما بعد v1.
              </span>
              {pricing.linkableCount > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="catalog-add-branch"
                  onClick={() => setLinkOpen(true)}
                >
                  + أضف فرعاً ({toArabicDigits(String(pricing.linkableCount))})
                </Button>
              ) : null}
              {bulkChannel !== null ? (
                <a
                  data-testid="catalog-nudge-bulk"
                  href={bulkChannel.href}
                  className="whitespace-nowrap rounded-lg border border-ih-neutral-300 px-3 py-2 text-[12.5px] font-bold text-ih-primary-600"
                >
                  نبِّه {toArabicDigits(String(pricing.unpricedNames.length))} فروع بلا سعر
                </a>
              ) : null}
            </div>
          </section>

          {/* ── النشر ───────────────────────────────────────────────────── */}
          <section className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white shadow-sm">
            <div className="border-b border-ih-neutral-200 px-4.5 py-3.5">
              <h2 className="text-[14.5px] font-bold text-ih-neutral-800">النشر</h2>
            </div>
            <div className="flex flex-wrap items-center gap-4 p-4.5">
              <div className="flex w-[260px] shrink-0 flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold text-ih-neutral-700">حالة الخدمة</span>
                <div className="flex min-h-[44px] items-center rounded-lg border-[1.5px] border-ih-neutral-300 bg-ih-neutral-50 px-3">
                  <span className="text-[13px] font-bold text-ih-neutral-700">
                    {SERVICE_STATUS_AR[service.status].meaningAr}
                  </span>
                </div>
              </div>
              <span className="flex-1 text-[12.5px] leading-[1.7] text-ih-neutral-600">
                {service.status === 'published'
                  ? 'الإيقاف يمنع أي حجز جديد لها في كل الفروع. الحجوزات القائمة تُخدَم كما هي.'
                  : 'النشر يجعلها قابلة للحجز فوراً في كل فرع لديه سعر مُسجَّل. تحقَّق من ملاحظة التحضير أولاً — المريض يراها قبل أن يحجز.'}
              </span>
              <Button
                size="md"
                variant="destructive"
                data-testid="catalog-status-change"
                onClick={() => {
                  setConfirmTo(nextStatus)
                  router.replace(`/admin/catalog?service=${service.serviceId}&to=${nextStatus}`)
                }}
              >
                {nextStatus === 'published' ? 'نشر الخدمة' : 'إيقاف الخدمة'}
              </Button>
            </div>
          </section>

          <AuditPanel entries={audit} />
        </div>
      </main>

      {editing ? (
        <ServiceForm
          categories={categories}
          initial={{
            nameAr: service.nameAr,
            nameEn: service.nameEn,
            code: service.code ?? '',
            categoryId: service.categoryId,
            preparationNotesAr: service.preparationNotesAr ?? '',
            preparationNotesEn: service.preparationNotesEn ?? '',
            tatHours: service.defaultTatHours ?? 24,
          }}
          isPending={isPending}
          onCancel={() => setEditing(false)}
          onSubmit={(values) =>
            run(
              () => updateServiceAction(service.serviceId, values),
              () => setEditing(false),
            )
          }
        />
      ) : null}

      {confirmTo !== null ? (
        <StatusConfirm
          service={service}
          to={confirmTo}
          preview={statusPreview}
          isPending={isPending}
          onCancel={() => {
            setConfirmTo(null)
            router.replace(`/admin/catalog?service=${service.serviceId}`)
          }}
          onConfirm={() =>
            run(
              () => setServiceStatusAction(service.serviceId, confirmTo),
              () => setConfirmTo(null),
            )
          }
        />
      ) : null}

      {linkOpen ? (
        <LinkBranchDialog
          serviceNameAr={service.nameAr}
          linkable={pricing.linkableBranches}
          isPending={isPending}
          onCancel={() => setLinkOpen(false)}
          onLink={(branchId) =>
            run(
              () => linkServiceToBranchAction(service.serviceId, branchId),
              () => setLinkOpen(false),
            )
          }
        />
      ) : null}
    </>
  )
}

/**
 * ⚠ A LATIN VALUE IS ISOLATED INLINE — the BLOCK STAYS IN THE RTL FLOW.
 *
 * The first version put `dir="ltr"` on the `<dd>` itself. That does not just
 * fix the character order, it re-anchors the whole block: `text-start` under
 * `dir="ltr"` means LEFT, so the value slid to the far side of its grid cell
 * while its own `<dt>` stayed right-aligned. The label and the value it
 * describes stopped lining up, and at a glance an English name read as though
 * it belonged to the NEIGHBOURING label — «الرمز» sitting above
 * «Complete Blood Count (CBC)».
 *
 * Direction is a property of the TEXT RUN, not of the column. So the `<dd>`
 * inherits the page's RTL alignment and only the Latin run is isolated, which
 * is the same fix `isolateLtr()` applies to phone numbers in core (CLAUDE.md
 * §7). Caught by the founder on the deployed preview — precisely the class of
 * defect §9 says a capture finds and a markup review does not.
 */
function Detail({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11.5px] text-ih-neutral-500">{label}</dt>
      <dd className="font-semibold text-ih-neutral-800">
        {ltr ? (
          <bdi dir="ltr" className="font-mono">
            {value}
          </bdi>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

function StatusConfirm({
  service,
  to,
  preview,
  isPending,
  onCancel,
  onConfirm,
}: {
  service: ServiceDetail['service']
  to: ServiceStatus
  preview: StatusPreview | null
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  // The preview is fetched on the server via the `to` query param, requested by
  // the button that opened this dialog. Until it arrives there are no truthful
  // numbers, so the dialog says so rather than rendering a promise it cannot
  // back (the A03 rule). ⚠ Deliberately NOT triggering the fetch from here —
  // a side effect during render is how a dialog ends up in a refetch loop.
  if (preview === null || preview.to !== to) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-8"
        style={{ background: 'rgba(2,20,27,0.5)' }}
      >
        <div
          data-testid="catalog-status-confirm-loading"
          className="rounded-3xl bg-white px-8 py-6 text-[13px] text-ih-neutral-600 shadow-2xl"
        >
          يحسب أثر هذا التغيير…
        </div>
      </div>
    )
  }

  const publishing = to === 'published'
  const rows: ConfirmRow[] = publishing
    ? [
        {
          label: `${toArabicDigits(String(preview.pricing.pricedCount))} فروع تظهر فيها الخدمة فوراً`,
          value: formatPriceRangeEgpAr(preview.pricing.minPriceEgp, preview.pricing.maxPriceEgp),
          tone: 'good',
        },
        {
          label: `${toArabicDigits(String(preview.pricing.unpricedCount))} فروع لن تظهر — بلا سعر`,
          value: preview.pricing.unpricedNames.slice(0, 3).join(' · ') || '—',
          tone: 'warn',
        },
        {
          label: 'ملاحظة التحضير المرافقة',
          value: preview.hasPreparationNote ? 'مكتوبة — تظهر قبل الحجز' : 'لا توجد',
          tone: preview.hasPreparationNote ? 'neutral' : 'warn',
        },
        ...(preview.categoryIsActive
          ? []
          : [
              {
                label: 'التصنيف غير مفعّل',
                value: 'لن تظهر للمرضى حتى تُفعّله',
                tone: 'warn' as const,
              },
            ]),
      ]
    : [
        {
          label: `${toArabicDigits(String(preview.pricing.pricedCount))} فروع تختفي فيها الخدمة فوراً`,
          value: `${toArabicDigits(String(preview.pricing.providerCount))} مزودين`,
          tone: 'warn',
        },
        {
          label: `${toArabicDigits(String(preview.outstandingBookings))} حجزاً قائماً لا تتأثر`,
          value: 'تُخدَم وتُحاسَب في كشوفها',
          tone: 'good',
        },
        {
          label: 'متوسط الحجوزات الأسبوعية لهذه الخدمة',
          value: `${toArabicDigits(String(preview.weeklyBookingAverage))} حجزاً`,
          tone: 'neutral',
          emphasise: true,
        },
      ]

  return (
    <ConsequentialConfirm
      testId="catalog-status-confirm"
      title={
        publishing
          ? 'النشر يجعل الخدمة قابلة للحجز الآن'
          : 'إيقاف الخدمة يمنع الحجوزات الجديدة في كل الفروع'
      }
      body={
        publishing
          ? `تظهر «${service.nameAr}» في بحث المرضى فوراً في الفروع التي سجّل شركاؤها سعراً لها. الفروع بلا سعر لا تظهر حتى يُسعِّرها الشريك.`
          : `تختفي «${service.nameAr}» من بحث المرضى فوراً. لا يُحذف شيء: أسعار الشركاء وملاحظة التحضير تبقى، وتعود الخدمة بحالتها إن أعدت نشرها.`
      }
      rows={rows}
      acknowledgement={
        publishing
          ? 'راجعتُ الاسم وملاحظة التحضير، وأفهم أن المرضى يمكنهم الحجز فور النشر.'
          : 'أفهم أن الخدمة تختفي من التطبيق فوراً، وأن الحجوزات القائمة تبقى ويجب أن تُخدَم.'
      }
      confirmLabel={
        publishing
          ? `نشر في ${toArabicDigits(String(preview.pricing.pricedCount))} فروع الآن`
          : `إيقاف الخدمة في ${toArabicDigits(String(preview.pricing.pricedCount))} فروع`
      }
      confirmTestId="catalog-status-confirm-submit"
      pending={isPending}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

function LinkBranchDialog({
  serviceNameAr,
  linkable,
  isPending,
  onCancel,
  onLink,
}: {
  serviceNameAr: string
  linkable: ServiceDetail['pricing']['linkableBranches']
  isPending: boolean
  onCancel: () => void
  onLink: (branchId: string) => void
}) {
  const [branchId, setBranchId] = useState(linkable[0]?.branchId ?? '')

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-8"
      style={{ background: 'rgba(2,20,27,0.5)' }}
    >
      <div
        data-testid="catalog-link-dialog"
        role="dialog"
        aria-modal="true"
        className="w-[560px] max-w-full overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex flex-col gap-2 px-6 pt-5">
          <span className="text-[17px] font-extrabold text-ih-neutral-800">
            أضف فرعاً يقدّم «{serviceNameAr}»
          </span>
          <span className="text-[13px] leading-[1.7] text-ih-neutral-600">
            يُضاف الفرع بلا سعر ومخفياً — يظهر في الجدول كـ «بلا سعر — لن تظهر» حتى يُسجّل الشريك
            سعره من بوابته. الإضافة وحدها لا تُظهر الخدمة للمرضى.
          </span>
        </div>
        <div className="px-6 py-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-ih-neutral-700">الفرع</span>
            <select
              data-testid="catalog-link-branch"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="min-h-[44px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[14px]"
            >
              {linkable.map((branch) => (
                <option key={branch.branchId} value={branch.branchId}>
                  {branch.providerNameAr} — {branch.branchNameAr}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-ih-neutral-200 bg-ih-neutral-50 px-6 py-3.5">
          <Button size="md" variant="ghost" onClick={onCancel} disabled={isPending}>
            إلغاء
          </Button>
          <Button
            size="md"
            data-testid="catalog-link-submit"
            disabled={branchId === '' || isPending}
            onClick={() => onLink(branchId)}
          >
            أضف الفرع
          </Button>
        </div>
      </div>
    </div>
  )
}

/** «سجل التغييرات» — renders both portals' events, «من أي بوابة». */
function AuditPanel({ entries }: { entries: readonly ServiceDetail['audit'][number][] }) {
  const ACTION_AR: Record<string, string> = {
    service_created: 'إنشاء الخدمة كمسودة',
    service_updated: 'تعديل التعريف',
    service_published: 'نشر الخدمة',
    service_suspended: 'إيقاف الخدمة',
    service_linked_to_branch: 'إضافة فرع',
    branch_price_changed: 'تغيير سعر فرع',
  }
  const render = (value: unknown): string => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'boolean') return value ? 'نعم' : 'لا'
    return toArabicDigits(String(value))
  }

  return (
    <section
      data-testid="catalog-audit"
      className="flex flex-col gap-3 rounded-xl border border-ih-neutral-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[15px] font-extrabold text-ih-neutral-800">سجل التغييرات</h2>
          <span className="text-[11.5px] text-ih-neutral-500">على هذه الخدمة — من أي بوابة</span>
        </div>
        <span className="shrink-0 text-[12px] text-ih-neutral-500">
          {toArabicDigits(String(entries.length))} تعديلات
        </span>
      </div>

      {entries.length === 0 ? (
        <p data-testid="catalog-audit-empty" className="text-[12.5px] text-ih-neutral-500">
          لا تعديلات بعد — أول تغيير يُسجَّل هنا باسمك وتاريخه.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {entries.map((entry, index) => {
            const keys = [
              ...new Set([...Object.keys(entry.newValues), ...Object.keys(entry.oldValues)]),
            ]
            return (
              <li
                key={`${entry.changedAt}-${index}`}
                data-testid="catalog-audit-entry"
                className="flex flex-col gap-1 border-b border-ih-neutral-100 pb-2.5 last:border-0"
              >
                <span className="text-[12.5px] font-bold text-ih-neutral-800">
                  {ACTION_AR[entry.action] ?? entry.action}
                </span>
                {keys.map((key) => (
                  <span key={key} className="text-[11.5px] text-ih-neutral-600">
                    {key in entry.oldValues ? (
                      <>
                        من <span className="line-through">{render(entry.oldValues[key])}</span>{' '}
                        إلى{' '}
                      </>
                    ) : null}
                    <span className="font-semibold text-ih-neutral-800">
                      {render(entry.newValues[key])}
                    </span>
                  </span>
                ))}
                <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-ih-neutral-500">
                  {entry.who} · {fmtWhen(entry.changedAt)}
                  <span
                    className="whitespace-nowrap rounded-full px-2 py-[2px] text-[10.5px] font-semibold"
                    style={
                      entry.source === 'admin'
                        ? { color: '#FFFFFF', background: '#023449' }
                        : {
                            color: resolveTokenCss('neutral.600'),
                            background: resolveTokenCss('neutral.100'),
                          }
                    }
                  >
                    {entry.source === 'admin' ? 'الإدارة' : 'بوابة الشركاء'}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
