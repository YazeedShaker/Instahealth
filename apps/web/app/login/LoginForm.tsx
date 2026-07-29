'use client'

import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { signIn, type LoginState } from './actions'

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="lg"
      fullWidth
      loading={pending}
      disabled={disabled}
      data-testid="login-submit"
    >
      تسجيل الدخول
    </Button>
  )
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, { errorAr: null })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const emailId = useId()
  const passwordId = useId()

  // Same predicate as the design's mock.
  const cannotSubmit = !email.includes('@') || password.length < 4

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input type="hidden" name="next" value={next} />

      <Input
        id={emailId}
        name="email"
        type="email"
        dir="ltr"
        autoComplete="username"
        data-testid="login-email"
        label="البريد الإلكتروني"
        placeholder="reception@saridarlabs.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <Input
        id={passwordId}
        name="password"
        type={showPassword ? 'text' : 'password'}
        dir="ltr"
        autoComplete="current-password"
        data-testid="login-password"
        label="كلمة المرور"
        placeholder="••••••••"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        labelAside={
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ih-primary-600)' }}>
            هل نسيتها؟
          </span>
        }
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((on) => !on)}
            aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              fontSize: 15,
              color: 'var(--ih-neutral-500)',
              cursor: 'pointer',
            }}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        }
      />

      {/* Shared front desks are the norm — the design makes this an explicit,
          unticked choice rather than a silent default. */}
      <button
        type="button"
        role="checkbox"
        aria-checked={remember}
        data-testid="login-remember"
        onClick={() => setRemember((on) => !on)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 44,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            borderWidth: 1.5,
            borderStyle: 'solid',
            borderColor: remember ? 'var(--ih-primary-400)' : 'var(--ih-neutral-300)',
            background: remember ? 'var(--ih-primary-400)' : 'var(--ih-neutral-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 12,
            flexShrink: 0,
            transition: 'all var(--ih-duration-fast) var(--ih-ease-sharp)',
          }}
        >
          {remember ? '✓' : ''}
        </span>
        <span style={{ fontSize: 13, color: 'var(--ih-neutral-600)' }}>
          إبقاء الجلسة مفتوحة على هذا الجهاز
        </span>
      </button>
      <input type="hidden" name="remember" value={remember ? '1' : '0'} />

      {state.errorAr !== null ? (
        <Alert type="error" testId="login-error">
          {state.errorAr}
        </Alert>
      ) : null}

      <SubmitButton disabled={cannotSubmit} />
    </form>
  )
}
