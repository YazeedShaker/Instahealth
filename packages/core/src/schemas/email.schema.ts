import { z } from 'zod'

/**
 * THE email rule. One authority, because "is this an email?" was answered five
 * different ways before this file existed and no two answers agreed:
 *
 * | predicate                                    | `a@b` | `a@b..com` | `حجز@مستشفى.مصر` |
 * | -------------------------------------------- | ----- | ---------- | ----------------- |
 * | `LoginForm` / `StaffView` `includes('@')`    | ✅    | ✅         | ✅                |
 * | `z.string().email()` in three server actions | ❌    | ❌         | ❌                |
 * | `isEmail()` in the admin-staff Edge Function | ❌    | ✅         | ✅                |
 *
 * The client accepted 10 of 15 malformed inputs the server rejected, and the
 * Edge Function disagreed with the server action that calls it. Measured, not
 * assumed — the table above is a real run.
 *
 * ⚠ THE RULE IS DELIBERATELY ZOD'S, NOT A STRICTER ONE OF OUR OWN. All three
 * server actions already enforced `z.string().email()`, so adopting it here
 * tightens the CLIENT to match the server and changes what the server accepts
 * by exactly nothing. Verified against the live dev DB before choosing it: all
 * 6 real accounts in `auth.users` pass (ASCII, lowercase, already trimmed), so
 * no partner or admin is locked out by making display as strict as enforcement.
 * Inventing a stricter regex here would have been a new way to reject a real
 * address, which is the failure mode this file exists to prevent.
 */

/** Normalize before judging: trim, then lowercase. */
const normalizeEmail = (value: string): string => value.trim().toLowerCase()

/**
 * ⚠ LOWERCASING IS PART OF THE RULE, not a nicety. GoTrue stores and matches
 * addresses lowercased, and the admin Edge Function already `.toLowerCase()`d
 * on create — so a desk typing `Reception@SaridarLabs.com` owns an account it
 * could not sign into if any layer compared raw strings. Normalizing in the one
 * schema both sides use means they cannot drift apart again.
 */
export const emailSchema = z
  .string({ message: 'email.required' })
  .transform(normalizeEmail)
  .pipe(z.string().min(1, { message: 'email.required' }).email({ message: 'email.invalid' }))

/**
 * The same rule as a boolean, for the places that need to ask rather than parse
 * — a submit-button predicate, an inline field error, `mailtoNudgeUrl`'s
 * "is there an address worth linking to?". Sharing the schema is what keeps the
 * button's opinion and the server's opinion identical.
 *
 * An empty/blank string is NOT an error here: a field the user has not filled
 * in yet is incomplete, not wrong, and shouting at an untouched input is the
 * opposite of the problem this fixes. Callers gate on `isBlank` first.
 */
export function isValidEmail(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return false
  return emailSchema.safeParse(value).success
}

/** True when the field is empty or whitespace — "not yet answered". */
export function isBlankEmail(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === ''
}

/**
 * The message key for an email field's CURRENT contents, or null when there is
 * nothing to say. Resolve with `getErrorMessage(key, 'ar')`.
 *
 * ⚠ `touched` GATES BOTH MESSAGES, not just the blank one. Every address is
 * malformed while it is being typed — `r`, `re`, `reception@` are all way-points
 * on the road to a valid one — so a field that judges before the user has
 * finished calls them wrong for doing nothing but typing. Callers pass
 * `touched` on blur, and pass `true` for the submit-button predicate, which
 * must refuse an untouched empty field that shows no message at all.
 *
 * Once touched, feedback goes live again: the error clears the moment the
 * address becomes valid rather than making them blur a second time to find out.
 */
export function emailFieldErrorKey(
  value: string | null | undefined,
  touched: boolean,
): 'email.required' | 'email.invalid' | null {
  if (!touched) return null
  if (isBlankEmail(value)) return 'email.required'
  return isValidEmail(value) ? null : 'email.invalid'
}

export type Email = z.infer<typeof emailSchema>
