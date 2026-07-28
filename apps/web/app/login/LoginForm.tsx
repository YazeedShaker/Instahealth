'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { signIn, type LoginState } from './actions'

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      data-testid="login-submit"
      disabled={disabled || pending}
      className="h-12 w-full rounded-lg bg-ih-primary-400 font-arabic text-base font-semibold text-white transition-opacity disabled:opacity-45"
    >
      {pending ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول'}
    </button>
  )
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, { errorAr: null })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Same predicate the design's mock uses for its disabled state.
  const cannotSubmit = !email.includes('@') || password.length < 4

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-[7px]">
        <label htmlFor="email" className="text-[13px] font-semibold text-ih-neutral-700">
          البريد الإلكتروني
        </label>
        <input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="username"
          data-testid="login-email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="reception@saridarlabs.com"
          className="min-h-12 w-full rounded-lg border-[1.5px] border-ih-neutral-200 bg-white px-3.5 font-english text-[15px] text-ih-neutral-800 outline-none focus:border-ih-primary-400"
        />
      </div>

      <div className="flex flex-col gap-[7px]">
        <div className="flex items-center justify-between gap-2.5">
          <label htmlFor="password" className="text-[13px] font-semibold text-ih-neutral-700">
            كلمة المرور
          </label>
          <span className="text-[12.5px] font-semibold text-ih-neutral-400">
            تواصل مع الدعم لإعادة التعيين
          </span>
        </div>
        <div className="relative flex items-center">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            dir="ltr"
            autoComplete="current-password"
            data-testid="login-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="min-h-12 w-full rounded-lg border-[1.5px] border-ih-neutral-200 bg-white px-3.5 pl-13 font-english text-[15px] text-ih-neutral-800 outline-none focus:border-ih-primary-400"
          />
          <button
            type="button"
            onClick={() => setShowPassword((on) => !on)}
            aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            className="absolute left-1.5 flex h-10 w-10 items-center justify-center rounded-lg text-[15px] text-ih-neutral-500"
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      {state.errorAr !== null ? (
        <div
          role="alert"
          data-testid="login-error"
          className="rounded-lg border border-ih-error/30 bg-ih-error-bg px-4 py-3 text-[13px] leading-6"
          style={{ color: 'var(--ih-error-text)' }}
        >
          {state.errorAr}
        </div>
      ) : null}

      <SubmitButton disabled={cannotSubmit} />
    </form>
  )
}
