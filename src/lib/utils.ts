import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges Tailwind classes without conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Decodes the payload of a JWT without verifying the signature.
 * Used client-side to extract claims (exp, user_id, org_id, role) after login.
 *
 * IMPORTANT: JWTs use base64url encoding (RFC 4648 §5) which replaces '+' with '-'
 * and '/' with '_'. The browser's `atob()` only accepts standard base64, so we must
 * normalise the encoding before decoding — otherwise `atob` throws for many tokens.
 */
export function parseJWT(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1]
    // Restore standard base64 from base64url before passing to atob().
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return {}
  }
}
