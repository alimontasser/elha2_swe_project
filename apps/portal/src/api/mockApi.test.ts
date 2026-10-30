import { describe, expect, it } from 'vitest'
import { createMockApi, DEMO_OTP, memoryStore } from './mockApi'
import { ApiError } from './types'

const make = (now = () => new Date('2026-10-30T10:00:00Z')) => createMockApi({ store: memoryStore(), latencyMs: 0, now })

describe('mock auth (US-1.01, NFR-12)', () => {
  it('signs in with the demo code', async () => {
    const api = make()
    await api.auth.sendCode('010 1234 5678')
    const session = await api.auth.verifyCode('01012345678', DEMO_OTP, 'businessOwner')
    expect(session).toEqual({ phone: '01012345678', role: 'businessOwner' })
    expect(api.auth.currentSession()).toEqual(session)
  })

  it('locks the number for 1 hour after 5 wrong codes', async () => {
    let t = new Date('2026-10-30T10:00:00Z').getTime()
    const api = make(() => new Date(t))
    await api.auth.sendCode('01012345678')
    for (let i = 0; i < 4; i++) {
      await expect(api.auth.verifyCode('01012345678', '000000', 'admin')).rejects.toMatchObject({ code: 'wrongCode' })
    }
    await expect(api.auth.verifyCode('01012345678', '000000', 'admin')).rejects.toMatchObject({ code: 'locked' })
    await expect(api.auth.verifyCode('01012345678', DEMO_OTP, 'admin')).rejects.toMatchObject({ code: 'locked' })
    t += 60 * 60 * 1000 + 1
    await api.auth.sendCode('01012345678')
    await expect(api.auth.verifyCode('01012345678', DEMO_OTP, 'admin')).resolves.toBeTruthy()
  })

  it('rejects numbers that are not Egyptian mobiles', async () => {
    await expect(make().auth.sendCode('0223456789')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('organisations and verification (US-1.06, 1.07, 13.01, 11.01)', () => {
  it('registers a business as pending and requires both documents', async () => {
    const api = make()
    const base = {
      name: 'Test Bakery',
      registrationNo: 'CR-1',
      licenceNo: 'L-1',
      branches: [{ name: 'Main', area: 'maadi' as const, address: 'St 9', opensAt: '08:00', closesAt: '20:00' }],
    }
    await expect(
      api.organisations.registerBusiness('01011112222', { ...base, documents: [{ kind: 'commercialRegistration', fileName: 'a.pdf' }] }),
    ).rejects.toMatchObject({ code: 'documentsRequired' })
    const org = await api.organisations.registerBusiness('01011112222', {
      ...base,
      documents: [
        { kind: 'commercialRegistration', fileName: 'a.pdf' },
        { kind: 'foodSafetyLicence', fileName: 'b.pdf' },
      ],
    })
    expect(org.verification).toBe('pending')
    expect((await api.admin.listForReview('pending')).map((o) => o.id)).toContain(org.id)
  })

  it('notifies every NGO coordinator when the admin decides', async () => {
    const api = make()
    const ngo = (await api.admin.listForReview('pending')).find((o) => o.kind === 'ngo')!
    await expect(api.admin.setVerification(ngo.id, 'rejected', '01000000000')).rejects.toMatchObject({ code: 'reasonRequired' })
    await api.admin.setVerification(ngo.id, 'infoRequested', '01000000000', 'Upload the 2026 certificate')
    if (ngo.kind !== 'ngo') throw new Error('expected an NGO')
    for (const phone of ngo.coordinatorPhones) {
      const [n] = await api.notifications.list(phone)
      expect(n).toMatchObject({ type: 'orgInfoRequested', orgName: ngo.name, reason: 'Upload the 2026 certificate' })
    }
  })
})
