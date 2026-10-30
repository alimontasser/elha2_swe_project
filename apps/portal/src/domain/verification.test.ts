import { describe, expect, it } from 'vitest'
import { seedDb } from '../api/seed'
import { normaliseEgyptianMobile } from './phone'
import { applyVerification, canOperate, VerificationError } from './verification'

const now = new Date('2026-10-30T10:00:00Z')
const pendingOrg = () => seedDb().organisations.find((o) => o.verification === 'pending')!

describe('verification state machine (US-13.01)', () => {
  it('approves a pending organisation and records who did it', () => {
    const org = applyVerification(pendingOrg(), 'verified', '01000000000', undefined, now)
    expect(org.verification).toBe('verified')
    expect(org.history.at(-1)).toEqual({ status: 'verified', at: now.toISOString(), byPhone: '01000000000', reason: undefined })
    expect(canOperate(org)).toBe(true)
  })

  it('requires a reason to reject or request information', () => {
    for (const status of ['rejected', 'infoRequested'] as const) {
      expect(() => applyVerification(pendingOrg(), status, '01000000000', '   ', now)).toThrow(VerificationError)
    }
    const org = applyVerification(pendingOrg(), 'rejected', '01000000000', ' Licence expired ', now)
    expect(org.history.at(-1)?.reason).toBe('Licence expired')
    expect(canOperate(org)).toBe(false)
  })

  it('does not let a verified organisation be re-decided', () => {
    const org = applyVerification(pendingOrg(), 'verified', '01000000000', undefined, now)
    expect(() => applyVerification(org, 'rejected', '01000000000', 'x', now)).toThrow(VerificationError)
  })

  it('blocks unverified organisations from operating (BR-01)', () => {
    expect(canOperate(pendingOrg())).toBe(false)
  })
})

describe('Egyptian mobile numbers (US-1.01)', () => {
  it.each([
    ['01012345678', '01012345678'],
    ['+20 112 345 6789', '01123456789'],
    ['00201512345678', '01512345678'],
    ['٠١٢٣٤٥٦٧٨٩٠', '01234567890'],
  ])('accepts %s', (input, expected) => {
    expect(normaliseEgyptianMobile(input)).toBe(expected)
  })

  it.each(['0101234567', '01312345678', '0223456789', 'abc'])('rejects %s', (input) => {
    expect(normaliseEgyptianMobile(input)).toBeNull()
  })
})
