'use client'

import { toArabicDigits } from '@instahealth/core'
import { STATUS_BADGES } from '@instahealth/design-tokens'

// Search + status filter + pager for the bookings tables.
//
// Every one of these narrows the query the DATABASE runs — nothing here filters
// an array in the browser. That matters less on a 5-booking day than it will on
// a branch with a real history, and it is the pattern the later P-series tables
// inherit.

/** The statuses a desk actually filters by. `pending_payment` is excluded
 * deliberately — the read function drops those rows as flow debris, so offering
 * the filter would promise a result set that can only ever be empty. */
const FILTERABLE_STATUSES = ['confirmed', 'arrived', 'completed', 'no_show', 'cancelled'] as const

export function BookingsToolbar({
  search,
  onSearch,
  status,
  onStatus,
  page,
  pageSize,
  total,
  onPage,
  isQuerying,
}: {
  search: string
  onSearch: (value: string) => void
  status: string | null
  onStatus: (value: string | null) => void
  page: number
  pageSize: number
  total: number
  onPage: (value: number) => void
  isQuerying: boolean
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const firstRow = total === 0 ? 0 : page * pageSize + 1
  const lastRow = Math.min((page + 1) * pageSize, total)
  const isFiltered = search.trim().length > 0 || status !== null

  return (
    <div
      data-print="hide"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        paddingBottom: 12,
      }}
    >
      <div style={{ position: 'relative', flex: '0 1 280px', minWidth: 200 }}>
        <input
          data-testid="bookings-search"
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="ابحث باسم المريض أو رقمه أو رقم الحجز"
          aria-label="بحث في الحجوزات"
          style={{
            width: '100%',
            minHeight: 38,
            borderRadius: 8,
            border: '1.5px solid var(--ih-neutral-200)',
            background: 'var(--ih-neutral-0)',
            color: 'var(--ih-neutral-800)',
            fontSize: 13,
            fontFamily: 'inherit',
            padding: '0 34px 0 12px',
            boxSizing: 'border-box',
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            insetInlineStart: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 13,
            color: 'var(--ih-neutral-400)',
            pointerEvents: 'none',
          }}
        >
          🔍
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <FilterChip label="الكل" isActive={status === null} onClick={() => onStatus(null)} />
        {FILTERABLE_STATUSES.map((key) => (
          <FilterChip
            key={key}
            testId={`filter-${key}`}
            label={STATUS_BADGES[key].labelAr}
            isActive={status === key}
            onClick={() => onStatus(status === key ? null : key)}
          />
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div
        data-testid="bookings-count"
        style={{
          fontSize: 12,
          color: 'var(--ih-neutral-500)',
          whiteSpace: 'nowrap',
          opacity: isQuerying ? 0.5 : 1,
          transition: 'opacity 120ms',
        }}
      >
        {total === 0
          ? isFiltered
            ? 'لا نتائج'
            : ''
          : `${toArabicDigits(String(firstRow))}–${toArabicDigits(String(lastRow))} من ${toArabicDigits(String(total))}`}
      </div>

      {/* The pager is ABSENT on a single page rather than disabled — a desk
          with five bookings should not be looking at dead controls. */}
      {pageCount > 1 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <PagerButton
            testId="page-prev"
            label="السابق"
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--ih-neutral-700)',
              padding: '0 6px',
              whiteSpace: 'nowrap',
            }}
          >
            {toArabicDigits(String(page + 1))} / {toArabicDigits(String(pageCount))}
          </span>
          <PagerButton
            testId="page-next"
            label="التالي"
            disabled={page + 1 >= pageCount}
            onClick={() => onPage(page + 1)}
          />
        </div>
      ) : null}
    </div>
  )
}

function FilterChip({
  label,
  isActive,
  onClick,
  testId,
}: {
  label: string
  isActive: boolean
  onClick: () => void
  testId?: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={isActive}
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
        borderRadius: 999,
        padding: '7px 12px',
        whiteSpace: 'nowrap',
        borderWidth: 1,
        borderStyle: 'solid',
        color: isActive ? 'var(--ih-primary-700)' : 'var(--ih-neutral-600)',
        background: isActive ? 'var(--ih-primary-50)' : 'var(--ih-neutral-0)',
        borderColor: isActive ? 'var(--ih-primary-400)' : 'var(--ih-neutral-200)',
      }}
    >
      {label}
    </button>
  )
}

function PagerButton({
  label,
  disabled,
  onClick,
  testId,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  testId: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'inherit',
        minHeight: 32,
        padding: '0 10px',
        borderRadius: 8,
        border: '1px solid var(--ih-neutral-200)',
        background: 'var(--ih-neutral-0)',
        color: 'var(--ih-neutral-700)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  )
}
