import { describe, expect, it } from 'vitest'
import { memoryStore } from './mockApi'
import { createSupabaseAuth, OtpGatewayError, type OtpFailure, type OtpGateway } from './supabaseAuth'
import { ApiError } from './types'

function fakeGateway(opts: { roles?: string[]; sendFailure?: OtpFailure; verifyFailure?: OtpFailure } = {}) {
  const sent: string[] = []
  let signOuts = 0
  const gateway: OtpGateway = {
    async sendOtp(phone) {
      if (opts.sendFailure) throw new OtpGatewayError(opts.sendFailure)
      sent.push(phone)
    },
    async verifyOtp(_phone, code) {
      if (opts.verifyFailure) throw new OtpGatewayError(opts.verifyFailure)
      if (code !== '654321') throw new OtpGatewayError('wrongCode')
      return { roles: opts.roles ?? [] }
    },
    async signOut() {
      signOuts++
    },
  }
  return { gateway, sent, signOuts: () => signOuts }
}

const code = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: unknown) => (e instanceof ApiError ? e.code : 'other'),
  )

describe('Supabase sign-in adapter (US-1.01)', () => {
  it('sends the code in international form and keeps the chosen organisation role', async () => {
    const { gateway, sent } = fakeGateway()
    const auth = createSupabaseAuth(gateway, memoryStore())
    await auth.sendCode('010 1111 2222')
    expect(sent).toEqual(['201011112222'])
    const session = await auth.verifyCode('01011112222', '654321', 'businessOwner')
    expect(session).toEqual({ phone: '01011112222', role: 'businessOwner' })
    expect(auth.currentSession()).toEqual(session)
  })

  it('only lets numbers with the admin role in the token sign in as administrator', async () => {
    const plain = fakeGateway()
    const auth = createSupabaseAuth(plain.gateway, memoryStore())
    expect(await code(auth.verifyCode('01011112222', '654321', 'admin'))).toBe('notAdmin')
    expect(plain.signOuts()).toBe(1)
    expect(auth.currentSession()).toBeNull()

    const admin = fakeGateway({ roles: ['admin'] })
    const session = await createSupabaseAuth(admin.gateway, memoryStore()).verifyCode('01000000000', '654321', 'admin')
    expect(session.role).toBe('admin')
  })

  it('locks a number after 5 wrong codes in an hour, across reloads', async () => {
    let now = new Date('2026-11-07T10:00:00Z')
    const store = memoryStore()
    const { gateway } = fakeGateway()
    const auth = createSupabaseAuth(gateway, store, () => now)
    for (let i = 0; i < 4; i++) expect(await code(auth.verifyCode('01011112222', '000000', 'businessOwner'))).toBe('wrongCode')
    expect(await code(auth.verifyCode('01011112222', '000000', 'businessOwner'))).toBe('locked')

    const reloaded = createSupabaseAuth(gateway, store, () => now)
    expect(await code(reloaded.verifyCode('01011112222', '654321', 'businessOwner'))).toBe('locked')
    expect(await code(reloaded.sendCode('01011112222'))).toBe('locked')

    now = new Date('2026-11-07T11:01:00Z')
    expect(await code(reloaded.verifyCode('01011112222', '654321', 'businessOwner'))).toBe('ok')
  })

  it('maps rate limits and outages to their own messages', async () => {
    expect(await code(createSupabaseAuth(fakeGateway({ sendFailure: 'rateLimited' }).gateway, memoryStore()).sendCode('01011112222'))).toBe(
      'rateLimited',
    )
    expect(
      await code(createSupabaseAuth(fakeGateway({ verifyFailure: 'unavailable' }).gateway, memoryStore()).verifyCode('01011112222', '654321', 'businessOwner')),
    ).toBe('unavailable')
  })
})
