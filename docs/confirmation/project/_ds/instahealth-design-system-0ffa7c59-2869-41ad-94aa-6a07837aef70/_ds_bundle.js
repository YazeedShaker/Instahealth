/* @ds-bundle: {"format":4,"namespace":"InstaHealthDesignSystem_0ffa7c","components":[{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"Card","sourcePath":"components/cards/Card.jsx"},{"name":"Alert","sourcePath":"components/feedback/Alert.jsx"},{"name":"Chip","sourcePath":"components/feedback/Chip.jsx"},{"name":"PreparationNote","sourcePath":"components/feedback/PreparationNote.jsx"},{"name":"StatusBadge","sourcePath":"components/feedback/StatusBadge.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"BookingSteps","sourcePath":"components/patterns/BookingSteps.jsx"},{"name":"BottomNav","sourcePath":"components/patterns/BottomNav.jsx"},{"name":"SidebarNav","sourcePath":"components/patterns/SidebarNav.jsx"},{"name":"SlotPicker","sourcePath":"components/patterns/SlotPicker.jsx"}],"sourceHashes":{"components/buttons/Button.jsx":"6f771a91df8f","components/cards/Card.jsx":"c63aa82fc110","components/feedback/Alert.jsx":"321bcc7c92c5","components/feedback/Chip.jsx":"ab6ab10ed067","components/feedback/PreparationNote.jsx":"8978d7e69d99","components/feedback/StatusBadge.jsx":"a5ccbeefd4f6","components/forms/Input.jsx":"3cab94c50396","components/forms/Select.jsx":"36a8a1a3493a","components/forms/Textarea.jsx":"c9b7583ea5dc","components/patterns/BookingSteps.jsx":"21c6cebde1cc","components/patterns/BottomNav.jsx":"1e51f1931ad7","components/patterns/SidebarNav.jsx":"0f1dd143342c","components/patterns/SlotPicker.jsx":"d2e4ef600a6a","ui_kits/patient-app/BookingFlow.jsx":"b2a6e3104c6b","ui_kits/patient-app/PatientScreens.jsx":"117e19739ba2","ui_kits/provider-dashboard/DashboardScreens.jsx":"d626afa8bc7b"},"inlinedExternals":[],"unexposedExports":[]} */

;(() => {
  const __ds_ns = (window.InstaHealthDesignSystem_0ffa7c =
    window.InstaHealthDesignSystem_0ffa7c || {})

  const __ds_scope = {}

  __ds_ns.__errors = __ds_ns.__errors || []

  // components/buttons/Button.jsx
  try {
    ;(() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e]
                  for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r])
                }
                return n
              }),
          _extends.apply(null, arguments)
        )
      }
      const SIZES = {
        sm: {
          padding: '0.375rem 0.875rem',
          fontSize: '0.8125rem',
        },
        md: {
          padding: '0.625rem 1.25rem',
          fontSize: '0.9375rem',
        },
        lg: {
          padding: '0.875rem 1.75rem',
          fontSize: '1rem',
        },
      }
      const VARIANTS = {
        primary: {
          background: 'var(--ih-primary-400)',
          color: '#fff',
          border: 'none',
        },
        secondary: {
          background: 'var(--ih-primary-600)',
          color: '#fff',
          border: 'none',
        },
        outline: {
          background: 'transparent',
          color: 'var(--ih-text-primary)',
          border: '1.5px solid var(--ih-border-strong)',
        },
        ghost: {
          background: 'transparent',
          color: 'var(--ih-primary-400)',
          border: 'none',
        },
        destructive: {
          background: 'var(--ih-error)',
          color: '#fff',
          border: 'none',
        },
        accent: {
          background: 'var(--ih-accent-300)',
          color: 'var(--ih-primary-700)',
          border: 'none',
          fontWeight: 700,
        },
      }
      function Button({
        variant = 'primary',
        size = 'md',
        loading = false,
        disabled = false,
        fullWidth = false,
        icon,
        children,
        style = {},
        ...rest
      }) {
        const hoverBg = {
          primary: 'var(--ih-primary-500)',
          secondary: 'var(--ih-primary-700)',
          destructive: '#B91C1C',
          accent: 'var(--ih-accent-400)',
        }[variant]
        const [hover, setHover] = React.useState(false)
        const base = VARIANTS[variant] || VARIANTS.primary
        return /*#__PURE__*/ React.createElement(
          'button',
          _extends(
            {
              disabled: disabled || loading,
              onMouseEnter: () => setHover(true),
              onMouseLeave: () => setHover(false),
              style: {
                ...(SIZES[size] || SIZES.md),
                ...base,
                ...(hover && hoverBg && !disabled && !loading
                  ? {
                      background: hoverBg,
                    }
                  : {}),
                ...(hover && !hoverBg && !disabled
                  ? {
                      opacity: 0.8,
                    }
                  : {}),
                borderRadius: 8,
                fontFamily: 'inherit',
                fontWeight: base.fontWeight || 600,
                cursor: disabled || loading ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.45 : loading ? 0.85 : undefined,
                transition: 'all var(--ih-duration-fast) var(--ih-ease-sharp)',
                lineHeight: 1.4,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 44,
                width: fullWidth ? '100%' : undefined,
                ...style,
              },
            },
            rest,
          ),
          loading &&
            /*#__PURE__*/ React.createElement('span', {
              style: {
                display: 'inline-block',
                width: 14,
                height: 14,
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'ih-spin 0.8s linear infinite',
              },
            }),
          !loading &&
            icon &&
            /*#__PURE__*/ React.createElement(
              'span',
              {
                'aria-hidden': 'true',
              },
              icon,
            ),
          children,
          /*#__PURE__*/ React.createElement(
            'style',
            null,
            '@keyframes ih-spin{to{transform:rotate(360deg)}}',
          ),
        )
      }
      Object.assign(__ds_scope, { Button })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'components/buttons/Button.jsx',
      error: String((e && e.message) || e),
    })
  }

  // components/cards/Card.jsx
  try {
    ;(() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e]
                  for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r])
                }
                return n
              }),
          _extends.apply(null, arguments)
        )
      }
      function Card({
        raised = false,
        topAccent = false,
        padding = '1.25rem',
        children,
        style = {},
        ...rest
      }) {
        return /*#__PURE__*/ React.createElement(
          'div',
          _extends(
            {
              style: {
                background: raised ? 'var(--ih-surface-raised)' : 'var(--ih-surface)',
                border: '1px solid var(--ih-border)',
                borderTop: topAccent ? '3px solid var(--ih-primary-400)' : undefined,
                borderRadius: 12,
                padding,
                boxShadow: raised ? 'var(--ih-shadow-raised)' : 'var(--ih-shadow-card)',
                ...style,
              },
            },
            rest,
          ),
          children,
        )
      }
      Object.assign(__ds_scope, { Card })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'components/cards/Card.jsx',
      error: String((e && e.message) || e),
    })
  }

  // components/feedback/Alert.jsx
  try {
    ;(() => {
      const CFG = {
        info: {
          bg: 'var(--ih-info-bg)',
          accent: 'var(--ih-info)',
          text: '#01677A',
          icon: 'ℹ',
        },
        success: {
          bg: 'var(--ih-success-bg)',
          accent: 'var(--ih-success)',
          text: '#017A61',
          icon: '✓',
        },
        warning: {
          bg: 'var(--ih-warning-bg)',
          accent: 'var(--ih-warning)',
          text: '#92400E',
          icon: '⚠',
        },
        error: {
          bg: 'var(--ih-error-bg)',
          accent: 'var(--ih-error)',
          text: '#991B1B',
          icon: '✕',
        },
      }
      function Alert({ type = 'info', children }) {
        const c = CFG[type] || CFG.info
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            role: type === 'error' ? 'alert' : 'status',
            style: {
              background: c.bg,
              borderRadius: 8,
              padding: '0.75rem 1rem',
              borderInlineStart: `3px solid ${c.accent}`,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            },
          },
          /*#__PURE__*/ React.createElement(
            'span',
            {
              'aria-hidden': 'true',
              style: {
                color: c.accent,
                fontWeight: 700,
                flexShrink: 0,
                fontSize: '0.875rem',
                lineHeight: 1.5,
              },
            },
            c.icon,
          ),
          /*#__PURE__*/ React.createElement(
            'span',
            {
              style: {
                fontSize: '0.875rem',
                color: c.text,
                lineHeight: 1.5,
              },
            },
            children,
          ),
        )
      }
      Object.assign(__ds_scope, { Alert })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'components/feedback/Alert.jsx',
      error: String((e && e.message) || e),
    })
  }

  // components/feedback/Chip.jsx
  try {
    ;(() => {
      function Chip({
        color = 'var(--ih-primary-700)',
        bg = 'var(--ih-primary-50)',
        children,
        style = {},
      }) {
        return /*#__PURE__*/ React.createElement(
          'span',
          {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px',
              borderRadius: 9999,
              background: bg,
              color,
              fontSize: '0.7rem',
              fontWeight: 600,
              ...style,
            },
          },
          children,
        )
      }
      Object.assign(__ds_scope, { Chip })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'components/feedback/Chip.jsx',
      error: String((e && e.message) || e),
    })
  }

  // components/feedback/PreparationNote.jsx
  try {
    ;(() => {
      function PreparationNote({ title, children }) {
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              background: 'var(--ih-accent-200)',
              border: '1px solid var(--ih-accent-400)',
              borderRadius: 8,
              padding: '0.875rem 1rem',
            },
          },
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--ih-primary-700)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '0.35rem',
              },
            },
            title || 'Preparation Required',
          ),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                fontSize: '0.875rem',
                color: 'var(--ih-primary-800)',
                lineHeight: 1.6,
              },
            },
            children,
          ),
        )
      }
      Object.assign(__ds_scope, { PreparationNote })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'components/feedback/PreparationNote.jsx',
      error: String((e && e.message) || e),
    })
  }

  // components/feedback/StatusBadge.jsx
  try {
    ;(() => {
      const CFG = {
        confirmed: {
          bg: 'var(--ih-success-bg)',
          color: '#028090',
          label: 'Confirmed',
          labelAr: 'مؤكد',
        },
        pending: {
          bg: 'var(--ih-warning-bg)',
          color: 'var(--ih-warning)',
          label: 'Pending',
          labelAr: 'قيد الانتظار',
        },
        completed: {
          bg: 'var(--ih-neutral-100)',
          color: 'var(--ih-neutral-700)',
          label: 'Completed',
          labelAr: 'مكتمل',
        },
        cancelled: {
          bg: 'var(--ih-error-bg)',
          color: 'var(--ih-error)',
          label: 'Cancelled',
          labelAr: 'ملغي',
        },
      }
      function StatusBadge({ status = 'pending', ar = false, children }) {
        const c = CFG[status] || CFG.pending
        return /*#__PURE__*/ React.createElement(
          'span',
          {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0.25rem 0.75rem',
              borderRadius: 9999,
              background: c.bg,
              color: c.color,
              fontSize: '0.75rem',
              fontWeight: 600,
            },
          },
          children || (ar ? c.labelAr : c.label),
        )
      }
      Object.assign(__ds_scope, { StatusBadge })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'components/feedback/StatusBadge.jsx',
      error: String((e && e.message) || e),
    })
  }

  // components/forms/Input.jsx
  try {
    ;(() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e]
                  for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r])
                }
                return n
              }),
          _extends.apply(null, arguments)
        )
      }
      function Input({ label, error, prefix, type = 'text', style = {}, ...rest }) {
        const [focus, setFocus] = React.useState(false)
        const borderColor = error
          ? 'var(--ih-error)'
          : focus
            ? 'var(--ih-primary-400)'
            : 'var(--ih-border)'
        return /*#__PURE__*/ React.createElement(
          'label',
          {
            style: {
              display: 'block',
            },
          },
          label &&
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: error ? 'var(--ih-error)' : 'var(--ih-text-secondary)',
                  marginBottom: '0.4rem',
                },
              },
              label,
            ),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              },
            },
            prefix &&
              /*#__PURE__*/ React.createElement(
                'span',
                {
                  style: {
                    position: 'absolute',
                    insetInlineStart: 12,
                    color: 'var(--ih-text-tertiary)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    pointerEvents: 'none',
                    zIndex: 1,
                  },
                },
                prefix,
              ),
            /*#__PURE__*/ React.createElement(
              'input',
              _extends(
                {
                  type: type,
                  onFocus: () => setFocus(true),
                  onBlur: () => setFocus(false),
                  style: {
                    width: '100%',
                    padding: prefix ? '0.625rem 1rem' : '0.625rem 1rem',
                    paddingInlineStart: prefix ? '2.75rem' : '1rem',
                    background: error ? 'var(--ih-error-bg)' : 'var(--ih-surface)',
                    border: `1.5px solid ${borderColor}`,
                    borderRadius: 8,
                    color: error ? '#991B1B' : 'var(--ih-text-primary)',
                    fontFamily: 'inherit',
                    fontSize: '0.9375rem',
                    outline: 'none',
                    transition: 'border-color var(--ih-duration-fast)',
                    minHeight: 44,
                    ...style,
                  },
                },
                rest,
              ),
            ),
          ),
          error &&
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontSize: '0.75rem',
                  color: 'var(--ih-error)',
                  marginTop: '0.25rem',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                },
              },
              /*#__PURE__*/ React.createElement(
                'span',
                {
                  'aria-hidden': 'true',
                },
                '\u26A0',
              ),
              ' ',
              error,
            ),
        )
      }
      Object.assign(__ds_scope, { Input })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'components/forms/Input.jsx',
      error: String((e && e.message) || e),
    })
  }

  // components/forms/Select.jsx
  try {
    ;(() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e]
                  for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r])
                }
                return n
              }),
          _extends.apply(null, arguments)
        )
      }
      function Select({ label, children, style = {}, ...rest }) {
        const [focus, setFocus] = React.useState(false)
        return /*#__PURE__*/ React.createElement(
          'label',
          {
            style: {
              display: 'block',
            },
          },
          label &&
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--ih-text-secondary)',
                  marginBottom: '0.4rem',
                },
              },
              label,
            ),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                position: 'relative',
              },
            },
            /*#__PURE__*/ React.createElement(
              'select',
              _extends(
                {
                  onFocus: () => setFocus(true),
                  onBlur: () => setFocus(false),
                  style: {
                    width: '100%',
                    padding: '0.625rem 1rem',
                    paddingInlineEnd: '2.25rem',
                    background: 'var(--ih-surface)',
                    border: `1.5px solid ${focus ? 'var(--ih-primary-400)' : 'var(--ih-border)'}`,
                    borderRadius: 8,
                    color: 'var(--ih-text-primary)',
                    fontFamily: 'inherit',
                    fontSize: '0.9375rem',
                    outline: 'none',
                    appearance: 'none',
                    minHeight: 44,
                    transition: 'border-color var(--ih-duration-fast)',
                    ...style,
                  },
                },
                rest,
              ),
              children,
            ),
            /*#__PURE__*/ React.createElement(
              'span',
              {
                'aria-hidden': 'true',
                style: {
                  position: 'absolute',
                  insetInlineEnd: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: 'var(--ih-text-tertiary)',
                  fontSize: '0.7rem',
                },
              },
              '\u25BC',
            ),
          ),
        )
      }
      Object.assign(__ds_scope, { Select })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'components/forms/Select.jsx',
      error: String((e && e.message) || e),
    })
  }

  // components/forms/Textarea.jsx
  try {
    ;(() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e]
                  for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r])
                }
                return n
              }),
          _extends.apply(null, arguments)
        )
      }
      function Textarea({ label, rows = 3, style = {}, ...rest }) {
        const [focus, setFocus] = React.useState(false)
        return /*#__PURE__*/ React.createElement(
          'label',
          {
            style: {
              display: 'block',
            },
          },
          label &&
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--ih-text-secondary)',
                  marginBottom: '0.4rem',
                },
              },
              label,
            ),
          /*#__PURE__*/ React.createElement(
            'textarea',
            _extends(
              {
                rows: rows,
                onFocus: () => setFocus(true),
                onBlur: () => setFocus(false),
                style: {
                  width: '100%',
                  padding: '0.625rem 1rem',
                  background: 'var(--ih-surface)',
                  border: `1.5px solid ${focus ? 'var(--ih-primary-400)' : 'var(--ih-border)'}`,
                  borderRadius: 8,
                  color: 'var(--ih-text-primary)',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  outline: 'none',
                  resize: 'vertical',
                  transition: 'border-color var(--ih-duration-fast)',
                  ...style,
                },
              },
              rest,
            ),
          ),
        )
      }
      Object.assign(__ds_scope, { Textarea })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'components/forms/Textarea.jsx',
      error: String((e && e.message) || e),
    })
  }

  // components/patterns/BookingSteps.jsx
  try {
    ;(() => {
      function BookingSteps({ steps = [], current = 0 }) {
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative',
            },
          },
          /*#__PURE__*/ React.createElement('div', {
            style: {
              position: 'absolute',
              top: 18,
              left: '10%',
              right: '10%',
              height: 2,
              background: 'var(--ih-border)',
              zIndex: 0,
            },
          }),
          steps.map((label, i) => {
            const done = i < current,
              active = i === current
            return /*#__PURE__*/ React.createElement(
              'div',
              {
                key: i,
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  zIndex: 1,
                  flex: 1,
                },
              },
              /*#__PURE__*/ React.createElement(
                'div',
                {
                  style: {
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: done
                      ? 'var(--ih-primary-400)'
                      : active
                        ? 'var(--ih-primary-600)'
                        : 'var(--ih-surface)',
                    border: done || active ? 'none' : '2px solid var(--ih-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: done || active ? '#fff' : 'var(--ih-text-tertiary)',
                    fontWeight: 700,
                    fontSize: done ? '1rem' : '0.875rem',
                  },
                },
                done ? '✓' : i + 1,
              ),
              /*#__PURE__*/ React.createElement(
                'div',
                {
                  style: {
                    fontSize: '0.7rem',
                    color: active
                      ? 'var(--ih-primary-400)'
                      : done
                        ? 'var(--ih-text-secondary)'
                        : 'var(--ih-text-tertiary)',
                    fontWeight: active || done ? 600 : 400,
                    textAlign: 'center',
                    lineHeight: 1.3,
                  },
                },
                label,
              ),
            )
          }),
        )
      }
      Object.assign(__ds_scope, { BookingSteps })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'components/patterns/BookingSteps.jsx',
      error: String((e && e.message) || e),
    })
  }

  // components/patterns/BottomNav.jsx
  try {
    ;(() => {
      function BottomNav({ items = [], active = 0, onSelect }) {
        return /*#__PURE__*/ React.createElement(
          'nav',
          {
            style: {
              background: 'var(--ih-surface)',
              borderTop: '1px solid var(--ih-border)',
              padding: '0.75rem 0 calc(0.75rem + env(safe-area-inset-bottom))',
              display: 'flex',
            },
          },
          items.map((it, i) => {
            const act = i === active
            return /*#__PURE__*/ React.createElement(
              'button',
              {
                key: i,
                onClick: () => onSelect && onSelect(i),
                'aria-current': act ? 'page' : undefined,
                style: {
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  fontFamily: 'inherit',
                  minHeight: 44,
                },
              },
              /*#__PURE__*/ React.createElement(
                'div',
                {
                  style: {
                    fontSize: act ? '1.5rem' : '1.25rem',
                    filter: act ? 'none' : 'grayscale(0.6) opacity(0.5)',
                    lineHeight: 1,
                  },
                },
                it.icon,
              ),
              /*#__PURE__*/ React.createElement(
                'div',
                {
                  style: {
                    fontSize: '0.6875rem',
                    fontWeight: act ? 700 : 400,
                    color: act ? 'var(--ih-primary-400)' : 'var(--ih-text-tertiary)',
                  },
                },
                it.label,
              ),
              act &&
                /*#__PURE__*/ React.createElement('div', {
                  style: {
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: 'var(--ih-primary-400)',
                  },
                }),
            )
          }),
        )
      }
      Object.assign(__ds_scope, { BottomNav })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'components/patterns/BottomNav.jsx',
      error: String((e && e.message) || e),
    })
  }

  // components/patterns/SidebarNav.jsx
  try {
    ;(() => {
      function SidebarNav({
        brand = 'InstaHealth',
        items = [],
        active = 0,
        onSelect,
        footer,
        style = {},
      }) {
        return /*#__PURE__*/ React.createElement(
          'nav',
          {
            style: {
              width: 220,
              background: 'var(--ih-surface-sidebar)',
              padding: '1rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              ...style,
            },
          },
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                fontSize: '0.7rem',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '0 0.5rem',
                marginBottom: '0.25rem',
              },
            },
            brand,
          ),
          items.map((it, i) => {
            const act = i === active
            return /*#__PURE__*/ React.createElement(
              'button',
              {
                key: i,
                onClick: () => onSelect && onSelect(i),
                'aria-current': act ? 'page' : undefined,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0.625rem 0.75rem',
                  borderRadius: 8,
                  background: act ? 'rgba(255,255,255,0.12)' : 'transparent',
                  cursor: 'pointer',
                  border: 'none',
                  fontFamily: 'inherit',
                  width: '100%',
                  textAlign: 'start',
                  minHeight: 44,
                },
              },
              /*#__PURE__*/ React.createElement(
                'span',
                {
                  style: {
                    fontSize: '1rem',
                  },
                },
                it.icon,
              ),
              /*#__PURE__*/ React.createElement(
                'span',
                {
                  style: {
                    fontSize: '0.875rem',
                    fontWeight: act ? 600 : 400,
                    color: act ? '#FFFFFF' : 'rgba(255,255,255,0.65)',
                  },
                },
                it.label,
              ),
            )
          }),
          footer &&
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  marginTop: 'auto',
                  padding: '0.75rem 0.5rem 0',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                },
              },
              footer,
            ),
        )
      }
      Object.assign(__ds_scope, { SidebarNav })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'components/patterns/SidebarNav.jsx',
      error: String((e && e.message) || e),
    })
  }

  // components/patterns/SlotPicker.jsx
  try {
    ;(() => {
      function SlotPicker({
        dates = [],
        times = [],
        selectedDate = 0,
        selectedTime = null,
        onSelectDate,
        onSelectTime,
        fullLabel = 'Full',
        title,
      }) {
        const [d, setD] = React.useState(selectedDate)
        const [t, setT] = React.useState(selectedTime)
        return /*#__PURE__*/ React.createElement(
          'div',
          null,
          title &&
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  color: 'var(--ih-text-primary)',
                  marginBottom: '1rem',
                },
              },
              title,
            ),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                gap: 8,
                marginBottom: '1rem',
                flexWrap: 'wrap',
              },
            },
            dates.map((date, i) =>
              /*#__PURE__*/ React.createElement(
                'button',
                {
                  key: i,
                  onClick: () => {
                    setD(i)
                    onSelectDate && onSelectDate(i)
                  },
                  style: {
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    background: i === d ? 'var(--ih-primary-400)' : 'var(--ih-surface)',
                    color: i === d ? '#fff' : 'var(--ih-text-secondary)',
                    border: i === d ? 'none' : '1px solid var(--ih-border)',
                    fontFamily: 'inherit',
                    fontSize: '0.8125rem',
                    fontWeight: i === d ? 700 : 400,
                    cursor: 'pointer',
                    minHeight: 44,
                  },
                },
                date,
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))',
                gap: 8,
              },
            },
            times.map((slot, i) => {
              const label = typeof slot === 'string' ? slot : slot.label
              const full = typeof slot === 'object' && slot.full
              const sel = i === t
              return /*#__PURE__*/ React.createElement(
                'button',
                {
                  key: i,
                  disabled: full,
                  onClick: () => {
                    setT(i)
                    onSelectTime && onSelectTime(i)
                  },
                  style: {
                    padding: '0.5rem',
                    borderRadius: 8,
                    background: sel
                      ? 'var(--ih-primary-400)'
                      : full
                        ? 'var(--ih-bg-subtle)'
                        : 'var(--ih-surface)',
                    color: sel
                      ? '#fff'
                      : full
                        ? 'var(--ih-text-placeholder)'
                        : 'var(--ih-text-primary)',
                    border: sel ? 'none' : '1px solid var(--ih-border)',
                    fontFamily: 'inherit',
                    fontSize: '0.875rem',
                    fontWeight: sel ? 700 : 400,
                    cursor: full ? 'not-allowed' : 'pointer',
                    opacity: full ? 0.5 : 1,
                    minHeight: 44,
                  },
                },
                label,
                full ? ' ●' : '',
              )
            }),
          ),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                fontSize: '0.75rem',
                color: 'var(--ih-text-tertiary)',
                marginTop: '0.75rem',
              },
            },
            '\u25CF ',
            fullLabel,
          ),
        )
      }
      Object.assign(__ds_scope, { SlotPicker })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'components/patterns/SlotPicker.jsx',
      error: String((e && e.message) || e),
    })
  }

  // ui_kits/patient-app/BookingFlow.jsx
  try {
    ;(() => {
      // Booking flow screens — branch profile, slot picker, details, confirmation.
      const {
        Button,
        Input,
        Textarea,
        Chip,
        Card,
        StatusBadge,
        Alert,
        PreparationNote,
        SlotPicker,
        BookingSteps,
      } = window.InstaHealthDesignSystem_0ffa7c
      const STEPS = ['اختر التحاليل', 'الموعد', 'البيانات', 'الدفع']
      const SERVICES = [
        {
          name: 'صورة دم كاملة CBC',
          price: 120,
          prep: true,
        },
        {
          name: 'سكر صائم',
          price: 60,
          prep: true,
        },
        {
          name: 'وظائف كبد',
          price: 150,
          prep: false,
        },
        {
          name: 'فيتامين د',
          price: 350,
          prep: false,
        },
      ]
      function StickyCTA({ label, sub, onClick, disabled }) {
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              position: 'sticky',
              bottom: 0,
              background: 'var(--ih-surface)',
              borderTop: '1px solid var(--ih-border)',
              padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
              zIndex: 10,
            },
          },
          sub &&
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontSize: '0.75rem',
                  color: 'var(--ih-text-secondary)',
                  marginBottom: 6,
                  textAlign: 'center',
                },
              },
              sub,
            ),
          /*#__PURE__*/ React.createElement(
            Button,
            {
              fullWidth: true,
              size: 'lg',
              disabled: disabled,
              onClick: onClick,
            },
            label,
          ),
        )
      }
      function HoldTimer({ seconds }) {
        const danger = seconds < 120
        const m = Math.floor(seconds / 60),
          s = String(seconds % 60).padStart(2, '0')
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: danger ? 'var(--ih-error-bg)' : 'var(--ih-accent-200)',
              borderRadius: 8,
              padding: '8px 12px',
              margin: '12px 16px 0',
            },
          },
          /*#__PURE__*/ React.createElement(
            'span',
            {
              style: {
                fontSize: '0.8125rem',
                color: danger ? '#991B1B' : 'var(--ih-primary-800)',
              },
            },
            '\u0627\u0644\u0645\u0648\u0639\u062F \u0645\u062D\u062C\u0648\u0632 \u0644\u0643 \u0644\u0645\u062F\u0629',
          ),
          /*#__PURE__*/ React.createElement(
            'span',
            {
              style: {
                fontFamily: 'var(--ih-font-mono)',
                fontWeight: 700,
                fontSize: '1rem',
                color: danger ? 'var(--ih-error)' : 'var(--ih-primary-700)',
              },
            },
            m,
            ':',
            s,
          ),
        )
      }
      function BranchScreen({ go, sel, setSel }) {
        const total = SERVICES.filter((_, i) => sel.includes(i)).reduce((a, s) => a + s.price, 0)
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              overflowY: 'auto',
            },
          },
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                background: 'linear-gradient(135deg, var(--ih-primary-700), var(--ih-primary-500))',
                padding: '18px 16px',
                color: '#fff',
              },
            },
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontWeight: 800,
                  fontSize: '1.25rem',
                },
              },
              '\u0645\u062E\u062A\u0628\u0631\u0627\u062A \u0627\u0644\u0628\u0631\u062C',
            ),
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontSize: '0.8125rem',
                  opacity: 0.85,
                  marginTop: 2,
                },
              },
              '\u0641\u0631\u0639 \u0646\u0635\u0631 \u0633\u064A\u062A\u064A \xB7 \u0664.\u0668 \u2605 (\u0662\u0664\u0663 \u062A\u0642\u064A\u064A\u0645) \xB7 \u0661.\u0662 \u0643\u0645',
            ),
          ),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                padding: '14px 16px 4px',
              },
            },
            /*#__PURE__*/ React.createElement(BookingSteps, {
              steps: STEPS,
              current: 0,
            }),
          ),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                padding: '10px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              },
            },
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontWeight: 700,
                  fontSize: '0.9375rem',
                },
              },
              '\u0627\u062E\u062A\u0631 \u0627\u0644\u062A\u062D\u0627\u0644\u064A\u0644',
            ),
            SERVICES.map((s, i) => {
              const on = sel.includes(i)
              return /*#__PURE__*/ React.createElement(
                'button',
                {
                  key: s.name,
                  onClick: () => setSel(on ? sel.filter((x) => x !== i) : [...sel, i]),
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: `1.5px solid ${on ? 'var(--ih-primary-400)' : 'var(--ih-border)'}`,
                    background: on ? 'var(--ih-primary-50)' : 'var(--ih-surface)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'start',
                    minHeight: 44,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  'span',
                  {
                    style: {
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: `2px solid ${on ? 'var(--ih-primary-400)' : 'var(--ih-border-strong)'}`,
                      background: on ? 'var(--ih-primary-400)' : 'transparent',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      flexShrink: 0,
                    },
                  },
                  on ? '✓' : '',
                ),
                /*#__PURE__*/ React.createElement(
                  'span',
                  {
                    style: {
                      flex: 1,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    'span',
                    {
                      style: {
                        display: 'block',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        color: 'var(--ih-text-primary)',
                      },
                    },
                    s.name,
                  ),
                  s.prep &&
                    /*#__PURE__*/ React.createElement(
                      'span',
                      {
                        style: {
                          fontSize: '0.7rem',
                          color: 'var(--ih-primary-700)',
                          background: 'var(--ih-accent-300)',
                          borderRadius: 99,
                          padding: '1px 8px',
                          fontWeight: 600,
                        },
                      },
                      '\u064A\u062A\u0637\u0644\u0628 \u0635\u064A\u0627\u0645',
                    ),
                ),
                /*#__PURE__*/ React.createElement(
                  'span',
                  {
                    style: {
                      fontWeight: 700,
                      fontSize: '0.9375rem',
                      color: 'var(--ih-text-primary)',
                    },
                  },
                  s.price,
                  ' \u062C.\u0645',
                ),
              )
            }),
            sel.some((i) => SERVICES[i].prep) &&
              /*#__PURE__*/ React.createElement(
                PreparationNote,
                {
                  title:
                    '\u062A\u0639\u0644\u064A\u0645\u0627\u062A \u0627\u0644\u062A\u062D\u0636\u064A\u0631',
                },
                '\u0635\u064A\u0627\u0645 \u0661\u0662 \u0633\u0627\u0639\u0629 \u0643\u0627\u0645\u0644 \u0636\u0631\u0648\u0631\u064A \u0642\u0628\u0644 \u0633\u062D\u0628 \u0627\u0644\u0639\u064A\u0646\u0629. \u0627\u0644\u0645\u0627\u0621 \u0641\u0642\u0637 \u0645\u0633\u0645\u0648\u062D.',
              ),
          ),
          /*#__PURE__*/ React.createElement('div', {
            style: {
              flex: 1,
            },
          }),
          /*#__PURE__*/ React.createElement(StickyCTA, {
            label: total ? `متابعة · ${total} ج.م` : 'اختر تحليلاً واحداً على الأقل',
            disabled: !total,
            onClick: () => go('slot'),
          }),
        )
      }
      function SlotScreen({ go }) {
        const [picked, setPicked] = React.useState(null)
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              overflowY: 'auto',
            },
          },
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                padding: '14px 16px 4px',
              },
            },
            /*#__PURE__*/ React.createElement(BookingSteps, {
              steps: STEPS,
              current: 1,
            }),
          ),
          picked !== null &&
            /*#__PURE__*/ React.createElement(HoldTimer, {
              seconds: 9 * 60 + 41,
            }),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                padding: '12px 16px',
              },
            },
            /*#__PURE__*/ React.createElement(SlotPicker, {
              title:
                '\u0627\u062E\u062A\u0631 \u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0648\u0627\u0644\u0648\u0642\u062A',
              fullLabel: '\u0645\u0645\u062A\u0644\u0626',
              dates: ['الثلاثاء ٢١', 'الأربعاء ٢٢', 'الخميس ٢٣', 'الجمعة ٢٤'],
              times: [
                '٨:٠٠',
                '٨:٣٠',
                {
                  label: '٩:٠٠',
                  full: true,
                },
                '٩:٣٠',
                '١٠:٠٠',
                '١٠:٣٠',
                '١١:٠٠',
                {
                  label: '١١:٣٠',
                  full: true,
                },
              ],
              onSelectTime: (i) => setPicked(i),
            }),
          ),
          /*#__PURE__*/ React.createElement('div', {
            style: {
              flex: 1,
            },
          }),
          /*#__PURE__*/ React.createElement(StickyCTA, {
            label: '\u0645\u062A\u0627\u0628\u0639\u0629',
            sub: picked !== null ? 'الموعد محجوز لك ١٠ دقائق — أكمل الحجز' : null,
            disabled: picked === null,
            onClick: () => go('details'),
          }),
        )
      }
      function DetailsScreen({ go }) {
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              overflowY: 'auto',
            },
          },
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                padding: '14px 16px 4px',
              },
            },
            /*#__PURE__*/ React.createElement(BookingSteps, {
              steps: STEPS,
              current: 2,
            }),
          ),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              },
            },
            /*#__PURE__*/ React.createElement(Input, {
              label: '\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644',
              defaultValue:
                '\u0645\u062D\u0645\u062F \u0623\u062D\u0645\u062F \u0627\u0644\u0633\u064A\u062F',
            }),
            /*#__PURE__*/ React.createElement(Input, {
              label: '\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641',
              prefix: '+20',
              defaultValue: '010 1234 5678',
            }),
            /*#__PURE__*/ React.createElement(Textarea, {
              label:
                '\u0645\u0644\u0627\u062D\u0638\u0627\u062A (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)',
              placeholder:
                '\u0623\u064A \u0645\u0644\u0627\u062D\u0638\u0627\u062A \u062E\u0627\u0635\u0629 \u0644\u0644\u0645\u062E\u062A\u0628\u0631...',
              rows: 2,
            }),
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontWeight: 700,
                  fontSize: '0.9375rem',
                  marginTop: 4,
                },
              },
              '\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639',
            ),
            [
              ['💳', 'بطاقة بنكية', 'Paymob — دفع آمن'],
              ['🧾', 'فوري', 'كود مرجعي للدفع'],
              ['💵', 'الدفع عند الوصول', 'كاش في الفرع'],
            ].map(([ic, l, sub], i) =>
              /*#__PURE__*/ React.createElement(
                'label',
                {
                  key: l,
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: `1.5px solid ${i === 2 ? 'var(--ih-primary-400)' : 'var(--ih-border)'}`,
                    background: i === 2 ? 'var(--ih-primary-50)' : 'var(--ih-surface)',
                    cursor: 'pointer',
                  },
                },
                /*#__PURE__*/ React.createElement('input', {
                  type: 'radio',
                  name: 'pay',
                  defaultChecked: i === 2,
                  style: {
                    accentColor: '#02C39A',
                    width: 18,
                    height: 18,
                  },
                }),
                /*#__PURE__*/ React.createElement(
                  'span',
                  {
                    style: {
                      fontSize: '1.25rem',
                    },
                  },
                  ic,
                ),
                /*#__PURE__*/ React.createElement(
                  'span',
                  null,
                  /*#__PURE__*/ React.createElement(
                    'span',
                    {
                      style: {
                        display: 'block',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      },
                    },
                    l,
                  ),
                  /*#__PURE__*/ React.createElement(
                    'span',
                    {
                      style: {
                        fontSize: '0.75rem',
                        color: 'var(--ih-text-secondary)',
                      },
                    },
                    sub,
                  ),
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              Card,
              {
                padding: '0.875rem',
                style: {
                  background: 'var(--ih-bg-subtle)',
                },
              },
              [
                ['التحاليل', 'صورة دم · سكر صائم'],
                ['الموعد', 'الثلاثاء ٢١ مايو · ٩:٣٠ ص'],
                ['الإجمالي', '١٨٠ ج.م'],
              ].map(([l, v]) =>
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    key: l,
                    style: {
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '3px 0',
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    'span',
                    {
                      style: {
                        fontSize: '0.8125rem',
                        color: 'var(--ih-text-tertiary)',
                      },
                    },
                    l,
                  ),
                  /*#__PURE__*/ React.createElement(
                    'span',
                    {
                      style: {
                        fontSize: '0.875rem',
                        fontWeight: 600,
                      },
                    },
                    v,
                  ),
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement('div', {
            style: {
              flex: 1,
            },
          }),
          /*#__PURE__*/ React.createElement(StickyCTA, {
            label:
              '\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062D\u062C\u0632 \xB7 \u0661\u0668\u0660 \u062C.\u0645',
            onClick: () => go('confirm'),
          }),
        )
      }
      function ConfirmScreen({ go }) {
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              overflowY: 'auto',
              padding: '24px 16px',
              gap: 14,
            },
          },
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                textAlign: 'center',
              },
            },
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'var(--ih-success-bg)',
                  color: 'var(--ih-primary-500)',
                  fontSize: '1.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px',
                },
              },
              '\u2713',
            ),
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontWeight: 800,
                  fontSize: '1.25rem',
                },
              },
              '\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u062D\u062C\u0632\u0643 \u0628\u0646\u062C\u0627\u062D!',
            ),
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontSize: '0.875rem',
                  color: 'var(--ih-text-secondary)',
                  marginTop: 4,
                },
              },
              '\u0633\u062A\u0635\u0644\u0643 \u0631\u0633\u0627\u0644\u0629 \u062A\u0623\u0643\u064A\u062F \u0642\u0631\u064A\u0628\u0627\u064B',
            ),
          ),
          /*#__PURE__*/ React.createElement(
            Card,
            {
              style: {
                borderRadius: 14,
              },
            },
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                },
              },
              /*#__PURE__*/ React.createElement(
                'div',
                {
                  style: {
                    fontWeight: 700,
                    fontSize: '0.9375rem',
                  },
                },
                '\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062D\u062C\u0632',
              ),
              /*#__PURE__*/ React.createElement(StatusBadge, {
                status: 'confirmed',
                ar: true,
              }),
            ),
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                },
              },
              [
                ['المختبر', 'البرج - نصر سيتي'],
                ['التحاليل', 'صورة دم كاملة · سكر صائم'],
                ['التاريخ', 'الثلاثاء ٢١ مايو ٢٠٢٦'],
                ['الوقت', '٩:٣٠ صباحاً'],
                ['رقم الحجز', 'IH-2026-00123'],
                ['المبلغ', '١٨٠ ج.م — دفع عند الوصول'],
              ].map(([l, v]) =>
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    key: l,
                    style: {
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 8,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    'span',
                    {
                      style: {
                        fontSize: '0.8125rem',
                        color: 'var(--ih-text-tertiary)',
                        flexShrink: 0,
                      },
                    },
                    l,
                  ),
                  /*#__PURE__*/ React.createElement(
                    'span',
                    {
                      style: {
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        textAlign: 'left',
                      },
                    },
                    v,
                  ),
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            PreparationNote,
            {
              title:
                '\u062A\u0630\u0643\u064A\u0631 \u0628\u0627\u0644\u062A\u062D\u0636\u064A\u0631',
            },
            '\u0635\u064A\u0627\u0645 \u0661\u0662 \u0633\u0627\u0639\u0629 \u0643\u0627\u0645\u0644 \u0636\u0631\u0648\u0631\u064A. \u0627\u0644\u0645\u0627\u0621 \u0641\u0642\u0637 \u0645\u0633\u0645\u0648\u062D. \u064A\u064F\u0641\u0636\u0644 \u0627\u0644\u0648\u0635\u0648\u0644 \u0642\u0628\u0644 \u0627\u0644\u0645\u0648\u0639\u062F \u0628\u0640 \u0661\u0660 \u062F\u0642\u0627\u0626\u0642.',
          ),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                gap: 8,
              },
            },
            /*#__PURE__*/ React.createElement(
              Button,
              {
                variant: 'outline',
                style: {
                  flex: 1,
                },
              },
              '\uD83D\uDDD3\uFE0F \u0623\u0636\u0641 \u0644\u0644\u062A\u0642\u0648\u064A\u0645',
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                variant: 'accent',
                style: {
                  flex: 1,
                },
                onClick: () => go('home'),
              },
              '\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629',
            ),
          ),
        )
      }
      Object.assign(window, {
        BranchScreen,
        SlotScreen,
        DetailsScreen,
        ConfirmScreen,
        StickyCTA,
        HoldTimer,
        IH_STEPS: STEPS,
      })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'ui_kits/patient-app/BookingFlow.jsx',
      error: String((e && e.message) || e),
    })
  }

  // ui_kits/patient-app/PatientScreens.jsx
  try {
    ;(() => {
      // Patient app screens — Home, Search. RTL Arabic, light theme.
      const { Button, Input, Chip, Card, BottomNav } = window.InstaHealthDesignSystem_0ffa7c
      const BRANCHES = [
        {
          name: 'مختبرات البرج',
          branch: 'فرع نصر سيتي',
          rating: '٤.٨',
          reviews: '٢٤٣ تقييم',
          dist: '١.٢ كم منك',
          open: 'مفتوح حتى ١٠م',
          tags: ['صورة دم', 'سكر', 'كوليسترول'],
          cat: '🔬 تحاليل',
          price: '١٨٠ ج.م',
        },
        {
          name: 'معامل المختبر',
          branch: 'فرع مصر الجديدة',
          rating: '٤.٦',
          reviews: '١٨٧ تقييم',
          dist: '٢.٤ كم منك',
          open: 'مفتوح حتى ٩م',
          tags: ['هرمونات', 'فيتامين د'],
          cat: '🔬 تحاليل',
          price: '٢٢٠ ج.م',
        },
        {
          name: 'سكان القاهرة',
          branch: 'فرع المعادي',
          rating: '٤.٧',
          reviews: '٣١١ تقييم',
          dist: '٣.١ كم منك',
          open: 'مفتوح ٢٤ ساعة',
          tags: ['أشعة', 'رنين'],
          cat: '🩻 أشعة',
          price: '٤٥٠ ج.م',
        },
      ]
      function AppHeader({ title, onBack }) {
        return /*#__PURE__*/ React.createElement(
          'header',
          {
            style: {
              height: 56,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 16px',
              background: 'var(--ih-surface)',
              borderBottom: '1px solid var(--ih-border)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              flexShrink: 0,
            },
          },
          onBack &&
            /*#__PURE__*/ React.createElement(
              'button',
              {
                onClick: onBack,
                'aria-label': '\u0631\u062C\u0648\u0639',
                style: {
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: 'var(--ih-text-primary)',
                  minWidth: 44,
                  minHeight: 44,
                },
              },
              '\u2192',
            ),
          title
            ? /*#__PURE__*/ React.createElement(
                'div',
                {
                  style: {
                    fontWeight: 700,
                    fontSize: '1rem',
                  },
                },
                title,
              )
            : /*#__PURE__*/ React.createElement(
                'div',
                {
                  style: {
                    fontWeight: 800,
                    fontSize: '1.125rem',
                  },
                },
                /*#__PURE__*/ React.createElement(
                  'span',
                  {
                    style: {
                      color: 'var(--ih-text-primary)',
                    },
                  },
                  'Insta',
                ),
                /*#__PURE__*/ React.createElement(
                  'span',
                  {
                    style: {
                      color: 'var(--ih-primary-400)',
                    },
                  },
                  'Health',
                ),
              ),
        )
      }
      function HomeScreen({ go }) {
        const cats = [
          ['🔬', 'تحاليل طبية', '+٦٠٠ فرع'],
          ['🩻', 'أشعة', '+٢٠٠ مركز'],
          ['🩺', 'عيادات', '+٣٥٠ عيادة'],
          ['💊', 'صيدليات', 'توصيل سريع'],
        ]
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              overflowY: 'auto',
            },
          },
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                padding: '20px 16px 0',
              },
            },
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontSize: '1.375rem',
                  fontWeight: 800,
                  lineHeight: 1.4,
                },
              },
              '\u0623\u0647\u0644\u0627\u064B \u0645\u062D\u0645\u062F \uD83D\uDC4B',
            ),
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontSize: '0.875rem',
                  color: 'var(--ih-text-secondary)',
                  marginTop: 2,
                },
              },
              '\u0623\u0633\u0631\u0639 \u0641\u064A \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u062E\u062F\u0645\u0629 \u0637\u0628\u064A\u0629 \u0642\u0631\u064A\u0628\u0629 \u0645\u0646\u0643',
            ),
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  marginTop: 14,
                },
                onClick: () => go('search'),
              },
              /*#__PURE__*/ React.createElement(Input, {
                prefix: '\uD83D\uDD0D',
                placeholder:
                  '\u0627\u0628\u062D\u062B \u0639\u0646 \u062A\u062D\u0627\u0644\u064A\u0644\u060C \u0623\u0637\u0628\u0627\u0621\u060C \u0635\u064A\u062F\u0644\u064A\u0627\u062A...',
                readOnly: true,
              }),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                padding: '18px 16px 8px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              },
            },
            cats.map(([icon, label, sub]) =>
              /*#__PURE__*/ React.createElement(
                Card,
                {
                  key: label,
                  padding: '1rem',
                  style: {
                    borderRadius: 14,
                    textAlign: 'center',
                    cursor: 'pointer',
                  },
                  onClick: () => go('search'),
                },
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    style: {
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: 'var(--ih-primary-50)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      margin: '0 auto 8px',
                    },
                  },
                  icon,
                ),
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    style: {
                      fontWeight: 700,
                      fontSize: '0.875rem',
                    },
                  },
                  label,
                ),
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    style: {
                      fontSize: '0.75rem',
                      color: 'var(--ih-text-secondary)',
                    },
                  },
                  sub,
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                padding: '8px 16px 20px',
              },
            },
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  background: 'var(--ih-accent-200)',
                  border: '1px solid var(--ih-accent-400)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                },
              },
              /*#__PURE__*/ React.createElement(
                'span',
                {
                  style: {
                    fontSize: '1.25rem',
                  },
                },
                '\uD83D\uDDD3\uFE0F',
              ),
              /*#__PURE__*/ React.createElement(
                'div',
                {
                  style: {
                    flex: 1,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    style: {
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: 'var(--ih-primary-700)',
                    },
                  },
                  '\u062D\u062C\u0632\u0643 \u0627\u0644\u0642\u0627\u062F\u0645 \u2014 \u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621 \u0669:\u0663\u0660\u0635',
                ),
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    style: {
                      fontSize: '0.75rem',
                      color: 'var(--ih-primary-800)',
                    },
                  },
                  '\u0645\u062E\u062A\u0628\u0631\u0627\u062A \u0627\u0644\u0628\u0631\u062C \xB7 \u062A\u0630\u0643\u064A\u0631: \u0635\u064A\u0627\u0645 \u0661\u0662 \u0633\u0627\u0639\u0629',
                ),
              ),
            ),
          ),
        )
      }
      function BranchCard({ b, onBook }) {
        return /*#__PURE__*/ React.createElement(
          Card,
          {
            raised: true,
            padding: 0,
            style: {
              borderRadius: 14,
              overflow: 'hidden',
            },
          },
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                background: 'linear-gradient(135deg, var(--ih-primary-700), var(--ih-primary-500))',
                height: 64,
                padding: '12px',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'flex-start',
              },
            },
            /*#__PURE__*/ React.createElement(
              Chip,
              {
                color: '#fff',
                bg: 'rgba(255,255,255,0.18)',
              },
              b.cat,
            ),
          ),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                padding: '14px',
              },
            },
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                },
              },
              /*#__PURE__*/ React.createElement(
                'div',
                null,
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    style: {
                      fontWeight: 700,
                      fontSize: '1rem',
                    },
                  },
                  b.name,
                ),
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    style: {
                      fontSize: '0.8125rem',
                      color: 'var(--ih-text-secondary)',
                      marginTop: 2,
                    },
                  },
                  b.branch,
                ),
              ),
              /*#__PURE__*/ React.createElement(
                'div',
                {
                  style: {
                    textAlign: 'left',
                    flexShrink: 0,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    style: {
                      fontWeight: 800,
                      fontSize: '1.125rem',
                      color: 'var(--ih-primary-400)',
                    },
                  },
                  b.rating,
                  ' \u2605',
                ),
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    style: {
                      fontSize: '0.7rem',
                      color: 'var(--ih-text-tertiary)',
                    },
                  },
                  b.reviews,
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  margin: '10px 0',
                  fontSize: '0.8125rem',
                  color: 'var(--ih-text-secondary)',
                  flexWrap: 'wrap',
                },
              },
              /*#__PURE__*/ React.createElement('span', null, '\uD83D\uDCCD'),
              ' ',
              b.dist,
              ' ',
              /*#__PURE__*/ React.createElement('span', null, '\xB7'),
              ' ',
              /*#__PURE__*/ React.createElement(
                'span',
                {
                  style: {
                    color: 'var(--ih-primary-600)',
                    fontWeight: 600,
                  },
                },
                '\u25CF ',
                b.open,
              ),
            ),
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  gap: 6,
                  marginBottom: 12,
                  flexWrap: 'wrap',
                },
              },
              b.tags.map((s) =>
                /*#__PURE__*/ React.createElement(
                  Chip,
                  {
                    key: s,
                  },
                  s,
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                fullWidth: true,
                onClick: onBook,
              },
              '\u0627\u062D\u062C\u0632 \u0627\u0644\u0622\u0646',
            ),
          ),
        )
      }
      function SearchScreen({ go }) {
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              overflowY: 'auto',
            },
          },
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                padding: '14px 16px 0',
              },
            },
            /*#__PURE__*/ React.createElement(Input, {
              prefix: '\uD83D\uDD0D',
              placeholder:
                '\u0627\u0628\u062D\u062B \u0639\u0646 \u062A\u062D\u0627\u0644\u064A\u0644\u060C \u0623\u0637\u0628\u0627\u0621\u060C \u0635\u064A\u062F\u0644\u064A\u0627\u062A...',
              defaultValue: '\u062A\u062D\u0627\u0644\u064A\u0644',
            }),
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  gap: 8,
                  margin: '12px 0',
                  flexWrap: 'wrap',
                },
              },
              /*#__PURE__*/ React.createElement(
                Chip,
                {
                  bg: 'var(--ih-primary-400)',
                  color: '#fff',
                  style: {
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                  },
                },
                '\u0627\u0644\u0623\u0642\u0631\u0628',
              ),
              /*#__PURE__*/ React.createElement(
                Chip,
                {
                  style: {
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                  },
                },
                '\u0627\u0644\u0623\u0639\u0644\u0649 \u062A\u0642\u064A\u064A\u0645\u0627\u064B',
              ),
              /*#__PURE__*/ React.createElement(
                Chip,
                {
                  style: {
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                  },
                },
                '\u0645\u0641\u062A\u0648\u062D \u0627\u0644\u0622\u0646',
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                padding: '0 16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              },
            },
            BRANCHES.map((b) =>
              /*#__PURE__*/ React.createElement(BranchCard, {
                key: b.name,
                b: b,
                onBook: () => go('branch'),
              }),
            ),
          ),
        )
      }
      Object.assign(window, {
        AppHeader,
        HomeScreen,
        SearchScreen,
        BranchCard,
        IH_BRANCHES: BRANCHES,
      })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'ui_kits/patient-app/PatientScreens.jsx',
      error: String((e && e.message) || e),
    })
  }

  // ui_kits/provider-dashboard/DashboardScreens.jsx
  try {
    ;(() => {
      // Provider dashboard screens — dark theme, LTR (staff tool), English UI with Arabic names.
      const { Card, Button, StatusBadge, Chip, Input, Select, Alert } =
        window.InstaHealthDesignSystem_0ffa7c
      const BOOKINGS = [
        {
          ref: 'IH-2026-00147',
          name: 'محمد أحمد السيد',
          tests: 'CBC · Fasting Sugar',
          time: '9:30 AM',
          status: 'confirmed',
          amount: 'EGP 180',
        },
        {
          ref: 'IH-2026-00146',
          name: 'سارة محمود',
          tests: 'Vitamin D',
          time: '10:00 AM',
          status: 'pending',
          amount: 'EGP 350',
        },
        {
          ref: 'IH-2026-00145',
          name: 'أحمد علي',
          tests: 'Lipid Panel',
          time: '10:30 AM',
          status: 'confirmed',
          amount: 'EGP 220',
        },
        {
          ref: 'IH-2026-00141',
          name: 'منى حسن',
          tests: 'CBC',
          time: '8:30 AM',
          status: 'completed',
          amount: 'EGP 120',
        },
        {
          ref: 'IH-2026-00139',
          name: 'خالد إبراهيم',
          tests: 'Liver Function',
          time: '8:00 AM',
          status: 'cancelled',
          amount: 'EGP 150',
        },
      ]
      function StatRow() {
        const stats = [
          ['Total Bookings Today', '47', '↑ 12% vs yesterday', '📅'],
          ['Revenue Today', 'EGP 8,140', '↑ 8% vs yesterday', '💰'],
          ['Pending Confirmation', '3', 'needs action', '⏳'],
          ['No-shows This Week', '2', '↓ from 5', '📉'],
        ]
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(4,1fr)',
              gap: 14,
            },
          },
          stats.map(([label, val, sub, ic]) =>
            /*#__PURE__*/ React.createElement(
              Card,
              {
                key: label,
                topAccent: true,
                style: {
                  borderRadius: 14,
                },
              },
              /*#__PURE__*/ React.createElement(
                'div',
                {
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    style: {
                      fontSize: '0.8125rem',
                      color: 'var(--ih-text-secondary)',
                    },
                  },
                  label,
                ),
                /*#__PURE__*/ React.createElement('span', null, ic),
              ),
              /*#__PURE__*/ React.createElement(
                'div',
                {
                  style: {
                    fontSize: '2rem',
                    fontWeight: 800,
                    letterSpacing: '-0.025em',
                    lineHeight: 1.1,
                  },
                },
                val,
              ),
              /*#__PURE__*/ React.createElement(
                'div',
                {
                  style: {
                    fontSize: '0.75rem',
                    color: 'var(--ih-text-tertiary)',
                    marginTop: 6,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  'span',
                  {
                    style: {
                      color: 'var(--ih-primary-400)',
                      fontWeight: 600,
                    },
                  },
                  sub.split(' ')[0],
                ),
                ' ',
                sub.split(' ').slice(1).join(' '),
              ),
            ),
          ),
        )
      }
      function BookingTable({ rows, actions }) {
        return /*#__PURE__*/ React.createElement(
          Card,
          {
            padding: 0,
            style: {
              borderRadius: 14,
              overflow: 'hidden',
            },
          },
          /*#__PURE__*/ React.createElement(
            'table',
            {
              style: {
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
              },
            },
            /*#__PURE__*/ React.createElement(
              'thead',
              null,
              /*#__PURE__*/ React.createElement(
                'tr',
                {
                  style: {
                    borderBottom: '1px solid var(--ih-border)',
                  },
                },
                ['Ref', 'Patient', 'Tests', 'Time', 'Status', 'Amount', actions ? '' : null]
                  .filter((h) => h !== null)
                  .map((h) =>
                    /*#__PURE__*/ React.createElement(
                      'th',
                      {
                        key: h,
                        style: {
                          textAlign: 'start',
                          padding: '10px 14px',
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: 'var(--ih-text-tertiary)',
                          fontWeight: 700,
                        },
                      },
                      h,
                    ),
                  ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              'tbody',
              null,
              rows.map((b) =>
                /*#__PURE__*/ React.createElement(
                  'tr',
                  {
                    key: b.ref,
                    style: {
                      borderBottom: '1px solid var(--ih-border)',
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    'td',
                    {
                      style: {
                        padding: '10px 14px',
                        fontFamily: 'var(--ih-font-mono)',
                        fontSize: '0.8125rem',
                        color: 'var(--ih-text-secondary)',
                      },
                    },
                    b.ref,
                  ),
                  /*#__PURE__*/ React.createElement(
                    'td',
                    {
                      style: {
                        padding: '10px 14px',
                        fontFamily: 'var(--ih-font-arabic)',
                        fontWeight: 600,
                      },
                    },
                    b.name,
                  ),
                  /*#__PURE__*/ React.createElement(
                    'td',
                    {
                      style: {
                        padding: '10px 14px',
                        color: 'var(--ih-text-secondary)',
                      },
                    },
                    b.tests,
                  ),
                  /*#__PURE__*/ React.createElement(
                    'td',
                    {
                      style: {
                        padding: '10px 14px',
                      },
                    },
                    b.time,
                  ),
                  /*#__PURE__*/ React.createElement(
                    'td',
                    {
                      style: {
                        padding: '10px 14px',
                      },
                    },
                    /*#__PURE__*/ React.createElement(StatusBadge, {
                      status: b.status,
                    }),
                  ),
                  /*#__PURE__*/ React.createElement(
                    'td',
                    {
                      style: {
                        padding: '10px 14px',
                        fontWeight: 600,
                      },
                    },
                    b.amount,
                  ),
                  actions &&
                    /*#__PURE__*/ React.createElement(
                      'td',
                      {
                        style: {
                          padding: '10px 14px',
                        },
                      },
                      b.status === 'pending' &&
                        /*#__PURE__*/ React.createElement(
                          Button,
                          {
                            size: 'sm',
                          },
                          'Confirm',
                        ),
                    ),
                ),
              ),
            ),
          ),
        )
      }
      function LiveBookingsScreen() {
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            },
          },
          /*#__PURE__*/ React.createElement(StatRow, null),
          /*#__PURE__*/ React.createElement(
            Alert,
            {
              type: 'warning',
            },
            '3 bookings are waiting for confirmation \u2014 patients are notified once you confirm.',
          ),
          /*#__PURE__*/ React.createElement(
            'div',
            null,
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                },
              },
              /*#__PURE__*/ React.createElement(
                'div',
                {
                  style: {
                    fontWeight: 700,
                    fontSize: '1rem',
                  },
                },
                "Today's Queue",
              ),
              /*#__PURE__*/ React.createElement(
                'div',
                {
                  style: {
                    display: 'flex',
                    gap: 8,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  Chip,
                  {
                    bg: 'var(--ih-primary-400)',
                    color: '#fff',
                    style: {
                      padding: '5px 12px',
                    },
                  },
                  'All',
                ),
                /*#__PURE__*/ React.createElement(
                  Chip,
                  {
                    bg: 'var(--ih-surface-raised)',
                    color: 'var(--ih-text-secondary)',
                    style: {
                      padding: '5px 12px',
                    },
                  },
                  'Pending',
                ),
                /*#__PURE__*/ React.createElement(
                  Chip,
                  {
                    bg: 'var(--ih-surface-raised)',
                    color: 'var(--ih-text-secondary)',
                    style: {
                      padding: '5px 12px',
                    },
                  },
                  'Confirmed',
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(BookingTable, {
              rows: BOOKINGS,
              actions: true,
            }),
          ),
        )
      }
      function AllBookingsScreen() {
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            },
          },
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr auto',
                gap: 10,
                alignItems: 'end',
              },
            },
            /*#__PURE__*/ React.createElement(Input, {
              label: 'Search',
              prefix: '\uD83D\uDD0D',
              placeholder: 'Ref, patient name, phone\u2026',
            }),
            /*#__PURE__*/ React.createElement(
              Select,
              {
                label: 'Status',
              },
              /*#__PURE__*/ React.createElement('option', null, 'All statuses'),
              /*#__PURE__*/ React.createElement('option', null, 'Confirmed'),
              /*#__PURE__*/ React.createElement('option', null, 'Pending'),
              /*#__PURE__*/ React.createElement('option', null, 'Completed'),
              /*#__PURE__*/ React.createElement('option', null, 'Cancelled'),
            ),
            /*#__PURE__*/ React.createElement(
              Select,
              {
                label: 'Date',
              },
              /*#__PURE__*/ React.createElement('option', null, 'Today'),
              /*#__PURE__*/ React.createElement('option', null, 'This week'),
              /*#__PURE__*/ React.createElement('option', null, 'This month'),
            ),
            /*#__PURE__*/ React.createElement(
              Button,
              {
                variant: 'secondary',
              },
              'Export',
            ),
          ),
          /*#__PURE__*/ React.createElement(BookingTable, {
            rows: [...BOOKINGS, ...BOOKINGS.slice(0, 2)].map((b, i) =>
              i > 4
                ? {
                    ...b,
                    ref: b.ref + '-B',
                  }
                : b,
            ),
          }),
        )
      }
      function ServicesScreen() {
        const services = [
          ['CBC — صورة دم كاملة', 'EGP 120', true, true],
          ['Fasting Blood Sugar — سكر صائم', 'EGP 60', true, true],
          ['Lipid Panel — كوليسترول', 'EGP 220', true, false],
          ['Vitamin D — فيتامين د', 'EGP 350', false, false],
          ['Liver Function — وظائف كبد', 'EGP 150', true, false],
        ]
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            },
          },
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              },
            },
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontWeight: 700,
                  fontSize: '1rem',
                },
              },
              'Services & Prices',
            ),
            /*#__PURE__*/ React.createElement(Button, null, '+ Add Service'),
          ),
          /*#__PURE__*/ React.createElement(
            Card,
            {
              padding: 0,
              style: {
                borderRadius: 14,
                overflow: 'hidden',
              },
            },
            services.map(([name, price, active, prep], i) =>
              /*#__PURE__*/ React.createElement(
                'div',
                {
                  key: name,
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: i < services.length - 1 ? '1px solid var(--ih-border)' : 'none',
                  },
                },
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    style: {
                      flex: 1,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    'div',
                    {
                      style: {
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      },
                    },
                    name,
                  ),
                  prep &&
                    /*#__PURE__*/ React.createElement(
                      'span',
                      {
                        style: {
                          fontSize: '0.7rem',
                          color: 'var(--ih-primary-700)',
                          background: 'var(--ih-accent-300)',
                          borderRadius: 99,
                          padding: '1px 8px',
                          fontWeight: 600,
                        },
                      },
                      'Fasting required',
                    ),
                ),
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    style: {
                      fontWeight: 700,
                      fontSize: '0.9375rem',
                      width: 90,
                    },
                  },
                  price,
                ),
                /*#__PURE__*/ React.createElement(
                  StatusBadge,
                  {
                    status: active ? 'confirmed' : 'completed',
                  },
                  active ? 'Active' : 'Hidden',
                ),
                /*#__PURE__*/ React.createElement(
                  Button,
                  {
                    variant: 'ghost',
                    size: 'sm',
                  },
                  'Edit',
                ),
              ),
            ),
          ),
        )
      }
      function SlotsScreen() {
        const hours = [
          '8:00',
          '8:30',
          '9:00',
          '9:30',
          '10:00',
          '10:30',
          '11:00',
          '11:30',
          '12:00',
          '12:30',
        ]
        const days = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu']
        const state = (d, h) =>
          (d * 7 + h * 3) % 11 === 0 ? 'booked' : (d + h) % 9 === 0 ? 'off' : 'open'
        return /*#__PURE__*/ React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            },
          },
          /*#__PURE__*/ React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              },
            },
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  fontWeight: 700,
                  fontSize: '1rem',
                },
              },
              'Allocated Slots \u2014 Week of 18 May',
            ),
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  gap: 8,
                },
              },
              /*#__PURE__*/ React.createElement(
                Button,
                {
                  variant: 'outline',
                  size: 'sm',
                },
                '\u25C2 Prev',
              ),
              /*#__PURE__*/ React.createElement(
                Button,
                {
                  variant: 'outline',
                  size: 'sm',
                },
                'Next \u25B8',
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            Card,
            {
              style: {
                borderRadius: 14,
                overflowX: 'auto',
              },
            },
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  display: 'grid',
                  gridTemplateColumns: `70px repeat(${hours.length},1fr)`,
                  gap: 4,
                  fontSize: '0.75rem',
                },
              },
              /*#__PURE__*/ React.createElement('div', null),
              hours.map((h) =>
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    key: h,
                    style: {
                      textAlign: 'center',
                      color: 'var(--ih-text-tertiary)',
                      padding: '4px 0',
                    },
                  },
                  h,
                ),
              ),
              days.map((d, di) => [
                /*#__PURE__*/ React.createElement(
                  'div',
                  {
                    key: d,
                    style: {
                      fontWeight: 700,
                      color: 'var(--ih-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                    },
                  },
                  d,
                ),
                ...hours.map((h, hi) => {
                  const s = state(di, hi)
                  return /*#__PURE__*/ React.createElement('div', {
                    key: d + h,
                    title: s,
                    style: {
                      height: 30,
                      borderRadius: 6,
                      background:
                        s === 'booked'
                          ? 'var(--ih-primary-400)'
                          : s === 'off'
                            ? 'transparent'
                            : 'var(--ih-surface-raised)',
                      border:
                        s === 'off'
                          ? '1px dashed var(--ih-border-strong)'
                          : '1px solid var(--ih-border)',
                      cursor: 'pointer',
                    },
                  })
                }),
              ]),
            ),
            /*#__PURE__*/ React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  gap: 16,
                  marginTop: 12,
                  fontSize: '0.75rem',
                  color: 'var(--ih-text-tertiary)',
                },
              },
              /*#__PURE__*/ React.createElement(
                'span',
                null,
                /*#__PURE__*/ React.createElement('span', {
                  style: {
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    background: 'var(--ih-primary-400)',
                    borderRadius: 3,
                    marginInlineEnd: 6,
                  },
                }),
                'Booked',
              ),
              /*#__PURE__*/ React.createElement(
                'span',
                null,
                /*#__PURE__*/ React.createElement('span', {
                  style: {
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    background: 'var(--ih-surface-raised)',
                    border: '1px solid var(--ih-border)',
                    borderRadius: 3,
                    marginInlineEnd: 6,
                  },
                }),
                'Open',
              ),
              /*#__PURE__*/ React.createElement(
                'span',
                null,
                /*#__PURE__*/ React.createElement('span', {
                  style: {
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    border: '1px dashed var(--ih-border-strong)',
                    borderRadius: 3,
                    marginInlineEnd: 6,
                  },
                }),
                'Unallocated',
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            Alert,
            {
              type: 'info',
            },
            'Patients only see slots you allocate to InstaHealth \u2014 your full schedule is never shown.',
          ),
        )
      }
      Object.assign(window, {
        LiveBookingsScreen,
        AllBookingsScreen,
        ServicesScreen,
        SlotsScreen,
        StatRow,
        BookingTable,
      })
    })()
  } catch (e) {
    __ds_ns.__errors.push({
      path: 'ui_kits/provider-dashboard/DashboardScreens.jsx',
      error: String((e && e.message) || e),
    })
  }

  __ds_ns.Button = __ds_scope.Button

  __ds_ns.Card = __ds_scope.Card

  __ds_ns.Alert = __ds_scope.Alert

  __ds_ns.Chip = __ds_scope.Chip

  __ds_ns.PreparationNote = __ds_scope.PreparationNote

  __ds_ns.StatusBadge = __ds_scope.StatusBadge

  __ds_ns.Input = __ds_scope.Input

  __ds_ns.Select = __ds_scope.Select

  __ds_ns.Textarea = __ds_scope.Textarea

  __ds_ns.BookingSteps = __ds_scope.BookingSteps

  __ds_ns.BottomNav = __ds_scope.BottomNav

  __ds_ns.SidebarNav = __ds_scope.SidebarNav

  __ds_ns.SlotPicker = __ds_scope.SlotPicker
})()
