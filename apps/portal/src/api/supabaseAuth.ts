import { AuthError, type SupabaseClient } from '@supabase/supabase-js'
import { createAttemptLimiter } from '../domain/attemptLimiter'
import { normaliseEgyptianMobile } from '../domain/phone'
import type { Role, Session } from '../domain/types'
import type { KeyValueStore } from './mockApi'
import { ApiError, type AuthApi } from './types'

// US-1.01 through Supabase Auth: SMS one-time code (expiry set in the project: 5 min).
// Supabase limits code checks per IP; the per-number limit (5 wrong codes per hour) is kept here.
// Roles come from the token's app_metadata.roles, which only the backend or an admin can set,
// so choosing "Administrator" on the sign-in form grants nothing by itself.

export type OtpFailure = 'wrongCode' | 'rateLimited' | 'unavailable'

export class OtpGatewayError extends Error {
  readonly failure: OtpFailure
  constructor(failure: OtpFailure) {
    super(failure)
    this.failure = failure
  }
}

/** The Supabase Auth calls the portal makes. `phone` is international without "+", e.g. 201012345678. */
export interface OtpGateway {
  sendOtp(phone: string): Promise<void>
  verifyOtp(phone: string, code: string): Promise<{ roles: string[] }>
  signOut(): Promise<void>
}

function mapError(error: unknown, verifying: boolean): OtpGatewayError {
  if (error instanceof AuthError) {
    if (error.status === 429 || error.code?.startsWith('over_')) return new OtpGatewayError('rateLimited')
    // Supabase answers a wrong or expired code with otp_expired (403).
    if (verifying && (error.code === 'otp_expired' || error.code === 'invalid_credentials' || error.status === 403)) {
      return new OtpGatewayError('wrongCode')
    }
  }
  return new OtpGatewayError('unavailable')
}

export function supabaseGateway(client: SupabaseClient): OtpGateway {
  return {
    async sendOtp(phone) {
      const { error } = await client.auth.signInWithOtp({ phone: `+${phone}` }).catch((e: unknown) => ({ error: e }))
      if (error) throw mapError(error, false)
    },
    async verifyOtp(phone, code) {
      const result = await client.auth
        .verifyOtp({ phone: `+${phone}`, token: code, type: 'sms' })
        .catch((e: unknown) => ({ data: null, error: e }))
      if (result.error || !result.data?.user) throw mapError(result.error, true)
      const roles = result.data.user.app_metadata?.roles
      return { roles: Array.isArray(roles) ? roles.filter((r): r is string => typeof r === 'string') : [] }
    },
    async signOut() {
      await client.auth.signOut().catch(() => undefined)
    },
  }
}

const SESSION_KEY = 'elha2-portal-session-v1'
const FAILURES_KEY = 'elha2-portal-otp-failures-v1'

export function createSupabaseAuth(gateway: OtpGateway, store: KeyValueStore, now: () => Date = () => new Date()): AuthApi {
  const limiter = createAttemptLimiter({
    now,
    load: () => store.get(FAILURES_KEY),
    save: (json) => store.set(FAILURES_KEY, json),
  })
  const international = (local: string) => `20${local.slice(1)}`

  function checked(phone: string): string {
    const normalised = normaliseEgyptianMobile(phone)
    if (!normalised) throw new ApiError('invalidPhone')
    const until = limiter.lockedUntil(normalised)
    if (until) throw new ApiError('locked', until.toISOString())
    return normalised
  }

  return {
    async sendCode(phone) {
      const normalised = checked(phone)
      try {
        await gateway.sendOtp(international(normalised))
      } catch (e) {
        throw new ApiError(e instanceof OtpGatewayError && e.failure === 'rateLimited' ? 'rateLimited' : 'unavailable')
      }
    },
    async verifyCode(phone, code, role: Role) {
      const normalised = checked(phone)
      let roles: string[]
      try {
        ;({ roles } = await gateway.verifyOtp(international(normalised), code.trim()))
      } catch (e) {
        const failure = e instanceof OtpGatewayError ? e.failure : 'unavailable'
        if (failure !== 'wrongCode') throw new ApiError(failure)
        limiter.recordFailure(normalised)
        const until = limiter.lockedUntil(normalised)
        throw until ? new ApiError('locked', until.toISOString()) : new ApiError('wrongCode')
      }
      limiter.clear(normalised)
      if (role === 'admin' && !roles.includes('admin')) {
        await gateway.signOut()
        throw new ApiError('notAdmin')
      }
      const session: Session = { phone: normalised, role }
      store.set(SESSION_KEY, JSON.stringify(session))
      return session
    },
    currentSession() {
      const raw = store.get(SESSION_KEY)
      if (!raw) return null
      try {
        return JSON.parse(raw) as Session
      } catch {
        return null
      }
    },
    signOut() {
      store.remove(SESSION_KEY)
      void gateway.signOut()
    },
  }
}
