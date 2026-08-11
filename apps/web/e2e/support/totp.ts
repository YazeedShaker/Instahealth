// RFC 6238, so a Playwright suite can act as the authenticator app.
//
// Deliberately hand-rolled rather than a dependency: it is fifteen lines, and
// the alternative is shipping an npm package into `pnpm audit` for a test.
//
// Lifted out of `admin.spec.ts` when `fidelity.spec.ts` needed the same thing
// to reach an aal2 session. Two hand-rolled copies of a crypto routine is how
// they drift, and a drifted TOTP fails as "invalid code" — a message that
// blames the credential, never the code that generated it.

import { createHmac } from 'node:crypto'

/** Base32 (RFC 4648, no padding) — the alphabet authenticator secrets use. */
function base32Decode(input: string): Buffer {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of input.replace(/[^A-Za-z2-7]/g, '').toUpperCase()) {
    const index = ALPHABET.indexOf(char)
    if (index >= 0) bits += index.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

/** The six digits an authenticator would be showing at `atMs`. */
export function totp(secret: string, atMs: number = Date.now()): string {
  const counter = Math.floor(atMs / 30_000)
  const buffer = Buffer.alloc(8)
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0)
  buffer.writeUInt32BE(counter >>> 0, 4)
  const digest = createHmac('sha1', base32Decode(secret)).update(buffer).digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(code).padStart(6, '0')
}

/** Supabase rejects a REPLAYED code, so a second verify in the same 30s window
 *  fails for a reason that has nothing to do with the feature under test. Wait
 *  the window out unconditionally — for a suite that verifies repeatedly, the
 *  only safe code is one from a step that has never been submitted. */
export async function waitForFreshWindow(): Promise<void> {
  const msIntoWindow = Date.now() % 30_000
  await new Promise((resolve) => setTimeout(resolve, 30_000 - msIntoWindow + 1_500))
}

/** Wait ONLY if the current step is nearly over.
 *
 * For a suite that verifies exactly once, `waitForFreshWindow` spends up to 30
 * idle seconds to solve a replay problem it does not have. What it does need is
 * to not submit a code that expires between the fill and the round trip — so
 * skip ahead only when the remaining validity is too thin to survive one. */
export async function waitForUsableWindow(minMsRemaining = 5_000): Promise<void> {
  const msRemaining = 30_000 - (Date.now() % 30_000)
  if (msRemaining >= minMsRemaining) return
  await new Promise((resolve) => setTimeout(resolve, msRemaining + 1_000))
}
