'use client'

import {
  formatLastUpdatedAr,
  getPriceChangePercent,
  getPriceErrorAr,
  isBigPriceChange,
  toArabicDigits,
  validateServicePrice,
} from '@instahealth/core'
import { signOut } from '../../app/login/actions'
import { useCallback, useMemo, useState } from 'react'

import {
  fetchBranchServices,
  updateBranchService,
  type BranchServiceRow,
} from '../../lib/services/branch-services'
import { createClient } from '../../lib/supabase/client'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { PriceConfirmDialog } from './PriceConfirmDialog'

// The prices editor from `Provider Dashboard - Prices Editor.dc.html`.
//
// Column grid per the design: الخدمة · السعر · آخر تحديث · متاحة · actions.
const GRID = 'grid grid-cols-[1fr_190px_150px_110px_150px] items-center gap-3'

export function PricesEditor({
  branchId,
  branchNameAr,
  displayName,
  initialServices,
  initialLoadFailed,
}: {
  branchId: string
  branchNameAr: string
  displayName: string
  initialServices: BranchServiceRow[]
  initialLoadFailed: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const [services, setServices] = useState(initialServices)
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [errorAr, setErrorAr] = useState<string | null>(null)
  const [noticeAr, setNoticeAr] = useState<string | null>(null)

  // Recomputed each render on purpose: "آخر تحديث" is a RELATIVE label, and
  // memoising it would freeze «الآن» on a row saved ten minutes ago. Building
  // one Date per render is far cheaper than the row rendering around it.
  const now = new Date()

  const refresh = useCallback(async () => {
    try {
      setServices(await fetchBranchServices(supabase, branchId))
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }, [supabase, branchId])

  const editing = services.find((row) => row.branchServiceId === editingId) ?? null
  const confirming = services.find((row) => row.branchServiceId === confirmingId) ?? null
  const draftValue = Number(draft)
  const draftError = editing !== null ? validateServicePrice(draft, editing.priceEgp) : null
  const canSave = editing !== null && draftError === null && draftValue !== editing.priceEgp

  const commit = useCallback(
    async (row: BranchServiceRow, priceEgp: number, isAvailable: boolean) => {
      setPendingId(row.branchServiceId)
      setErrorAr(null)

      // Optimistic — a price list is edited in runs, and a round trip per row
      // makes that feel like wading.
      const previous = services
      setServices((rows) =>
        rows.map((candidate) =>
          candidate.branchServiceId === row.branchServiceId
            ? { ...candidate, priceEgp, isAvailable, lastChangedAt: new Date().toISOString() }
            : candidate,
        ),
      )

      const result = await updateBranchService(supabase, row.branchServiceId, priceEgp, isAvailable)

      if (result.kind === 'ok' || result.kind === 'unchanged') {
        setNoticeAr(
          result.kind === 'unchanged'
            ? 'لم يتغيّر شيء.'
            : `تم حفظ سعر ${row.nameAr}. الحجوزات القائمة تحتفظ بسعرها القديم.`,
        )
      } else {
        setServices(previous) // rollback
        setErrorAr(getPriceErrorAr(result.kind === 'rejected' ? result.reason : 'unknown'))
      }

      setPendingId(null)
      setEditingId(null)
      setConfirmingId(null)
      setDraft('')
      // Re-read so "آخر تحديث" comes from the AUDIT TRAIL rather than the
      // optimistic timestamp we just invented.
      void refresh()
    },
    [services, supabase, refresh],
  )

  const handleSave = useCallback(() => {
    if (editing === null || !canSave) return
    // The design's threshold: big changes must be retyped. The SERVER's 10x
    // ratio is the real guard — this is fat-finger insurance on a shared desk.
    if (isBigPriceChange(editing.priceEgp, draftValue)) {
      setConfirmingId(editing.branchServiceId)
      return
    }
    void commit(editing, draftValue, editing.isAvailable)
  }, [editing, canSave, draftValue, commit])

  const grouped = useMemo(() => {
    const byCategory = new Map<string, BranchServiceRow[]>()
    for (const row of services) {
      const list = byCategory.get(row.categoryNameAr) ?? []
      list.push(row)
      byCategory.set(row.categoryNameAr, list)
    }
    return [...byCategory.entries()]
  }, [services])

  return (
    <>
      <header
        style={{
          flexShrink: 0,
          background: 'var(--ih-neutral-0)',
          borderBottom: '1px solid var(--ih-neutral-200)',
          boxShadow: 'var(--ih-shadow-sm)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          minHeight: 56,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ih-neutral-800)' }}>
            الخدمات والأسعار
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ih-neutral-500)' }}>
            {branchNameAr} · {toArabicDigits(String(services.length))} خدمة
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {/* The catalogue is ADMIN-owned (A-series): a branch sets prices and
            availability for services it already has, it does not invent new
            ones. Present but visibly inert, per SPEC-P03 §A.3. */}
        <Button size="sm" variant="outline" disabled title="قريباً — تُدار القائمة من InstaHealth">
          + إضافة خدمة
        </Button>
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingInlineEnd: 16,
            borderInlineEnd: '1px solid var(--ih-neutral-200)',
            whiteSpace: 'nowrap',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'var(--ih-primary-50)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--ih-primary-700)',
            }}
          >
            {displayName.trim().charAt(0)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ih-neutral-700)' }}>
              {displayName}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                data-testid="logout"
                style={{
                  fontSize: 11,
                  color: 'var(--ih-neutral-500)',
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                تسجيل خروج
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* The money contract, said out loud to the person changing prices. */}
          <div
            data-testid="prices-notice"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--ih-info-bg)',
              border: '1px solid rgba(2,128,144,0.25)',
              borderRadius: 8,
              padding: '10px 14px',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 14 }} aria-hidden="true">
              ℹ
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--ih-primary-800)', lineHeight: 1.6 }}>
              الأسعار تظهر للمرضى في التطبيق فوراً بعد الحفظ. الحجوزات القائمة تحتفظ بسعرها القديم.
            </span>
          </div>

          {errorAr !== null ? (
            <Alert type="error" testId="prices-error">
              {errorAr}
            </Alert>
          ) : null}
          {noticeAr !== null && errorAr === null ? (
            <Alert type="success" testId="prices-saved">
              {noticeAr}
            </Alert>
          ) : null}

          {loadFailed && services.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-ih-neutral-200 bg-white p-10 text-center">
              <div className="text-sm text-ih-neutral-700">
                تعذّر تحميل قائمة الخدمات — تحقق من الاتصال وحاول مرة أخرى.
              </div>
              <Button variant="outline" onClick={() => void refresh()}>
                إعادة المحاولة
              </Button>
            </div>
          ) : services.length === 0 ? (
            <FirstRun />
          ) : (
            grouped.map(([categoryNameAr, rows]) => (
              <Card key={categoryNameAr} padding={0} style={{ overflow: 'hidden' }}>
                <div
                  className={`${GRID} border-b border-ih-neutral-200 bg-ih-neutral-50 px-4 py-2.5 text-[11.5px] font-bold text-ih-neutral-500`}
                >
                  <div>{categoryNameAr}</div>
                  <div>السعر (EGP)</div>
                  <div>آخر تحديث</div>
                  <div>متاحة</div>
                  <div />
                </div>
                {rows.map((row) => {
                  const isEditing = row.branchServiceId === editingId
                  const isPending = row.branchServiceId === pendingId
                  const updatedLabel = formatLastUpdatedAr(row.lastChangedAt, now)
                  const percent =
                    isEditing && draftError === null
                      ? getPriceChangePercent(row.priceEgp, draftValue)
                      : 0

                  return (
                    <div
                      key={row.branchServiceId}
                      data-testid={`service-row-${row.branchServiceId}`}
                      className={`${GRID} min-h-16 border-b border-ih-neutral-100 px-4`}
                      style={{
                        background: isEditing
                          ? 'var(--ih-primary-50)'
                          : row.isAvailable
                            ? 'var(--ih-neutral-0)'
                            : 'var(--ih-neutral-50)',
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="truncate text-sm font-semibold text-ih-neutral-800">
                          {row.nameAr}
                        </span>
                        {row.preparationNotesAr !== null &&
                        !row.preparationNotesAr.startsWith('لا يشترط') ? (
                          <span
                            className="shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-bold"
                            style={{
                              color: 'var(--ih-primary-800)',
                              background: 'var(--ih-accent-200)',
                              borderColor: 'var(--ih-accent-400)',
                            }}
                          >
                            ⚠ تحضير
                          </span>
                        ) : null}
                      </div>

                      <div>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              data-testid={`price-input-${row.branchServiceId}`}
                              dir="ltr"
                              inputMode="numeric"
                              autoFocus
                              value={draft}
                              onChange={(event) =>
                                setDraft(event.target.value.replace(/\D/g, '').slice(0, 6))
                              }
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && canSave) handleSave()
                                if (event.key === 'Escape') {
                                  setEditingId(null)
                                  setDraft('')
                                }
                              }}
                              style={{
                                width: 96,
                                boxSizing: 'border-box',
                                minHeight: 40,
                                padding: '0 12px',
                                border: `1.5px solid ${
                                  draft.length > 0 && draftError !== null
                                    ? 'var(--ih-error)'
                                    : 'var(--ih-primary-400)'
                                }`,
                                borderRadius: 8,
                                fontFamily: 'inherit',
                                fontSize: 15,
                                fontWeight: 700,
                                color: 'var(--ih-neutral-800)',
                                textAlign: 'left',
                              }}
                            />
                            {draftError === null && percent !== 0 ? (
                              <span
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  color: percent > 0 ? '#92600A' : 'var(--ih-primary-700)',
                                }}
                              >
                                {percent > 0 ? '▲ ' : '▼ '}
                                {toArabicDigits(String(Math.abs(percent)))}%
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span
                            dir="ltr"
                            data-testid={`price-${row.branchServiceId}`}
                            style={{
                              fontSize: 16,
                              fontWeight: 800,
                              color: 'var(--ih-neutral-800)',
                              unicodeBidi: 'isolate',
                            }}
                          >
                            {toArabicDigits(String(row.priceEgp))}
                          </span>
                        )}
                      </div>

                      {/* Empty means absent: never edited shows the design's
                          «لم يُحدَّث بعد» in a warning tone, because a
                          placeholder price must not look maintained. */}
                      <div
                        data-testid={`updated-${row.branchServiceId}`}
                        style={{
                          fontSize: 12,
                          color: updatedLabel === null ? '#92600A' : 'var(--ih-neutral-500)',
                        }}
                      >
                        {updatedLabel ?? 'لم يُحدَّث بعد'}
                      </div>

                      <div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={row.isAvailable}
                          aria-label={`إتاحة ${row.nameAr}`}
                          data-testid={`toggle-${row.branchServiceId}`}
                          disabled={isPending}
                          onClick={() => void commit(row, row.priceEgp, !row.isAvailable)}
                          style={{
                            width: 44,
                            height: 26,
                            borderRadius: 999,
                            border: 'none',
                            background: row.isAvailable
                              ? 'var(--ih-primary-400)'
                              : 'var(--ih-neutral-300)',
                            padding: 3,
                            boxSizing: 'border-box',
                            cursor: isPending ? 'default' : 'pointer',
                            display: 'flex',
                            justifyContent: row.isAvailable ? 'flex-end' : 'flex-start',
                            transition: 'all 180ms',
                          }}
                        >
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 999,
                              background: '#fff',
                              boxShadow: '0 1px 3px rgba(5,102,141,0.25)',
                            }}
                          />
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              data-testid={`save-${row.branchServiceId}`}
                              disabled={!canSave}
                              loading={isPending}
                              onClick={handleSave}
                            >
                              حفظ
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingId(null)
                                setDraft('')
                              }}
                              style={{ color: 'var(--ih-neutral-600)' }}
                            >
                              تراجع
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`edit-${row.branchServiceId}`}
                            onClick={() => {
                              setEditingId(row.branchServiceId)
                              setDraft(String(row.priceEgp))
                              setErrorAr(null)
                              setNoticeAr(null)
                            }}
                          >
                            تعديل السعر
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </Card>
            ))
          )}
        </div>
      </main>

      {confirming !== null ? (
        <PriceConfirmDialog
          serviceNameAr={confirming.nameAr}
          currentPrice={confirming.priceEgp}
          nextPrice={draftValue}
          isPending={pendingId === confirming.branchServiceId}
          onConfirm={() => void commit(confirming, draftValue, confirming.isAvailable)}
          onDismiss={() => setConfirmingId(null)}
        />
      ) : null}
    </>
  )
}

/** The first-run onboarding moment from the design — this is the first screen
 * a partner uses in anger, so an empty table would be a bad handshake. */
function FirstRun() {
  const STEPS = [
    'ابدأ من قائمة التحاليل القياسية في InstaHealth — أسرع طريقة.',
    'عدّل سعر كل خدمة، واحذف ما لا يقدّمه فرعك.',
    'فعّل الخدمات لتظهر للمرضى ويبدأ الحجز.',
  ]
  return (
    <div
      data-testid="prices-first-run"
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <div
        style={{
          width: 560,
          maxWidth: '100%',
          background: 'var(--ih-neutral-0)',
          border: '1px solid var(--ih-neutral-200)',
          borderRadius: 16,
          boxShadow: 'var(--ih-shadow-sm)',
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            aria-hidden="true"
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'var(--ih-primary-50)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            💰
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ih-neutral-800)' }}>
              لنضبط أسعار خدماتك
            </div>
            <div style={{ fontSize: 13, color: 'var(--ih-neutral-600)', lineHeight: 1.6 }}>
              الأسعار الظاهرة للمرضى الآن تقديرية — حدّثها ليبدأ الحجز الفعلي.
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: 'var(--ih-neutral-50)',
            border: '1px solid var(--ih-neutral-200)',
            borderRadius: 12,
            padding: 16,
          }}
        >
          {STEPS.map((text, index) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: 'var(--ih-primary-50)',
                  color: 'var(--ih-primary-700)',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {toArabicDigits(String(index + 1))}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ih-neutral-700)', lineHeight: 1.6 }}>
                {text}
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ih-neutral-500)' }}>
          تحتاج مساعدة في التسعير؟{' '}
          <span style={{ fontWeight: 600, color: 'var(--ih-primary-600)' }}>دعم الشركاء ١٦٧٢٣</span>
        </div>
      </div>
    </div>
  )
}
