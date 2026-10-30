import type { Organisation, VerificationStatus } from './types'

// US-13.01: an administrator approves, rejects with a reason, or asks for more information.
// Allowed transitions keep a decided organisation from being silently re-decided.
const TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  pending: ['verified', 'rejected', 'infoRequested'],
  infoRequested: ['pending', 'verified', 'rejected'],
  verified: [],
  rejected: ['pending'],
}

export class VerificationError extends Error {
  readonly code: 'invalidTransition' | 'reasonRequired'
  constructor(code: 'invalidTransition' | 'reasonRequired') {
    super(code)
    this.code = code
  }
}

export function canTransition(from: VerificationStatus, to: VerificationStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function applyVerification(
  org: Organisation,
  to: VerificationStatus,
  byPhone: string,
  reason: string | undefined,
  now: Date,
): Organisation {
  if (!canTransition(org.verification, to)) {
    throw new VerificationError('invalidTransition')
  }
  const trimmed = reason?.trim()
  if ((to === 'rejected' || to === 'infoRequested') && !trimmed) {
    throw new VerificationError('reasonRequired')
  }
  return {
    ...org,
    verification: to,
    history: [...org.history, { status: to, at: now.toISOString(), byPhone, reason: trimmed || undefined }],
  }
}

// BR-01: only a verified business may list surplus; only a verified NGO may receive offers.
export function canOperate(org: Organisation): boolean {
  return org.verification === 'verified'
}
