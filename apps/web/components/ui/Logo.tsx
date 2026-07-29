import Image from 'next/image'

// The real mark from the design handoff (design/handoff/project/assets/logo/),
// mirrored into public/brand. P01's first build substituted a ⚕ emoji, which is
// not the brand and does not scale.
export function Logo({
  variant = 'color',
  size = 36,
  withWordmark = false,
}: {
  variant?: 'color' | 'white'
  size?: number
  withWordmark?: boolean
}) {
  const mark = (
    <Image
      src={`/brand/mark-${variant}.svg`}
      alt="InstaHealth"
      width={size}
      height={size}
      priority
      style={{ display: 'block', flexShrink: 0 }}
    />
  )

  if (!withWordmark) return mark

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      {mark}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
        <span
          style={{
            fontFamily: 'var(--font-cairo), sans-serif',
            fontWeight: 700,
            fontSize: 17,
            lineHeight: 1.25,
            color: '#044F6E',
            whiteSpace: 'nowrap',
          }}
        >
          انستاهيلث
        </span>
        <span
          dir="ltr"
          style={{
            fontFamily: 'var(--font-atkinson), sans-serif',
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.01em',
            lineHeight: 1,
            color: '#5E737C',
            whiteSpace: 'nowrap',
          }}
        >
          InstaHealth
        </span>
      </div>
    </div>
  )
}
