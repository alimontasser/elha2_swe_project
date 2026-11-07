import { createAttemptLimiter } from '../domain/attemptLimiter'
import { applyVerification, VerificationError } from '../domain/verification'
import { normaliseEgyptianMobile } from '../domain/phone'
import type { AppNotification, NotificationType, Organisation, Role, Session, VerificationStatus } from '../domain/types'
import { ApiError, type PortalApi } from './types'
import { seedDb, type DemoDb } from './seed'

// Demo-only implementation of the portal API. Every external service is faked:
// - Supabase Auth phone OTP: the code is always DEMO_OTP; 5 wrong codes in 1 h lock the number (NFR-12).
// - Supabase Storage: documents keep their file name only.
// - INotify / FCM: notifications are rows in the local store.
export const DEMO_OTP = '654321'
const MAX_ATTEMPTS = 5
const LOCK_MS = 60 * 60 * 1000
const DB_KEY = 'elha2-portal-demo-db-v1'
const SESSION_KEY = 'elha2-portal-demo-session-v1'

export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export function browserStore(): KeyValueStore {
  const memory = new Map<string, string>()
  return {
    get(key) {
      try {
        return window.localStorage.getItem(key)
      } catch {
        return memory.get(key) ?? null
      }
    },
    set(key, value) {
      memory.set(key, value)
      try {
        window.localStorage.setItem(key, value)
      } catch {
        /* storage blocked: keep the in-memory copy */
      }
    },
    remove(key) {
      memory.delete(key)
      try {
        window.localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    },
  }
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>()
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  }
}

interface Options {
  store?: KeyValueStore
  latencyMs?: number
  now?: () => Date
}

export function createMockApi({ store = browserStore(), latencyMs = 350, now = () => new Date() }: Options = {}): PortalApi {
  const limiter = createAttemptLimiter({ maxAttempts: MAX_ATTEMPTS, windowMs: LOCK_MS, now })
  const codesSent = new Set<string>()

  const delay = () => new Promise<void>((resolve) => setTimeout(resolve, latencyMs))
  const newId = (prefix: string) => `${prefix}-${now().getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

  function load(): DemoDb {
    const raw = store.get(DB_KEY)
    if (raw) {
      try {
        return JSON.parse(raw) as DemoDb
      } catch {
        /* corrupt: reseed */
      }
    }
    const db = seedDb()
    store.set(DB_KEY, JSON.stringify(db))
    return db
  }
  const save = (db: DemoDb) => store.set(DB_KEY, JSON.stringify(db))

  function notify(db: DemoDb, userPhone: string, type: NotificationType, org: Organisation, reason?: string) {
    const n: AppNotification = {
      id: newId('ntf'),
      userPhone,
      type,
      orgName: org.name,
      reason,
      deepLink: type === 'orgSubmitted' ? `/admin/organisations/${org.id}` : '/organisation',
      sentAt: now().toISOString(),
    }
    db.notifications.unshift(n)
  }

  function assertNotLocked(phone: string) {
    const until = limiter.lockedUntil(phone)
    if (until) throw new ApiError('locked', until.toISOString())
  }

  return {
    auth: {
      async sendCode(phone) {
        await delay()
        const normalised = normaliseEgyptianMobile(phone)
        if (!normalised) throw new ApiError('invalidPhone')
        assertNotLocked(normalised)
        codesSent.add(normalised)
      },
      async verifyCode(phone, code, role: Role) {
        await delay()
        const normalised = normaliseEgyptianMobile(phone)
        if (!normalised) throw new ApiError('invalidPhone')
        assertNotLocked(normalised)
        if (!codesSent.has(normalised)) throw new ApiError('codeNotSent')
        if (code.trim() !== DEMO_OTP) {
          limiter.recordFailure(normalised)
          assertNotLocked(normalised)
          throw new ApiError('wrongCode')
        }
        limiter.clear(normalised)
        codesSent.delete(normalised)
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
      },
    },

    organisations: {
      async mine(ownerPhone) {
        await delay()
        return load().organisations.filter(
          (o) => o.ownerPhone === ownerPhone || (o.kind === 'ngo' && o.coordinatorPhones.includes(ownerPhone)),
        )
      },
      async registerBusiness(ownerPhone, input) {
        await delay()
        if (input.branches.length === 0) throw new ApiError('branchRequired')
        const kinds = new Set(input.documents.map((d) => d.kind))
        if (!kinds.has('commercialRegistration') || !kinds.has('foodSafetyLicence')) throw new ApiError('documentsRequired')
        const db = load()
        const org: Organisation = {
          ...input,
          id: newId('org'),
          kind: 'business',
          ownerPhone,
          verification: 'pending',
          history: [{ status: 'pending', at: now().toISOString(), byPhone: ownerPhone }],
          createdAt: now().toISOString(),
        }
        db.organisations.unshift(org)
        save(db)
        return org
      },
      async registerNgo(ownerPhone, input) {
        await delay()
        if (input.documents.length === 0) throw new ApiError('documentsRequired')
        if (input.serviceAreas.length === 0 || input.foodTypes.length === 0) throw new ApiError('missingFields')
        const db = load()
        const coordinators = Array.from(new Set([ownerPhone, ...input.coordinatorPhones]))
        const org: Organisation = {
          ...input,
          coordinatorPhones: coordinators,
          id: newId('org'),
          kind: 'ngo',
          ownerPhone,
          verification: 'pending',
          history: [{ status: 'pending', at: now().toISOString(), byPhone: ownerPhone }],
          createdAt: now().toISOString(),
        }
        db.organisations.unshift(org)
        save(db)
        return org
      },
    },

    admin: {
      async listForReview(filter) {
        await delay()
        const all = load().organisations
        const list = filter === 'all' ? all : all.filter((o) => o.verification === filter)
        return [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      },
      async get(id) {
        await delay()
        return load().organisations.find((o) => o.id === id)
      },
      async setVerification(id, status: VerificationStatus, adminPhone, reason) {
        await delay()
        const db = load()
        const index = db.organisations.findIndex((o) => o.id === id)
        if (index < 0) throw new ApiError('notFound')
        let updated: Organisation
        try {
          updated = applyVerification(db.organisations[index], status, adminPhone, reason, now())
        } catch (e) {
          throw e instanceof VerificationError ? new ApiError(e.code) : e
        }
        db.organisations[index] = updated
        const type: NotificationType | null =
          status === 'verified' ? 'orgVerified' : status === 'rejected' ? 'orgRejected' : status === 'infoRequested' ? 'orgInfoRequested' : null
        if (type) {
          const recipients = updated.kind === 'ngo' ? updated.coordinatorPhones : [updated.ownerPhone]
          for (const phone of recipients) notify(db, phone, type, updated, reason?.trim())
        }
        save(db)
        return updated
      },
    },

    notifications: {
      async list(userPhone) {
        await delay()
        return load().notifications.filter((n) => n.userPhone === userPhone)
      },
      async markAllRead(userPhone) {
        await delay()
        const db = load()
        const at = now().toISOString()
        db.notifications = db.notifications.map((n) => (n.userPhone === userPhone && !n.readAt ? { ...n, readAt: at } : n))
        save(db)
      },
    },

    resetDemo() {
      store.set(DB_KEY, JSON.stringify(seedDb()))
      limiter.reset()
      codesSent.clear()
    },
  }
}
