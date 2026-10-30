import type {
  AppNotification,
  Area,
  Branch,
  FoodCategory,
  OrgDocument,
  Organisation,
  Role,
  Session,
  VerificationStatus,
} from '../domain/types'

// Interfaces the portal depends on. The demo uses mockApi; the real build swaps in
// adapters over Supabase Auth and the NestJS /api/v1 (SDD v1.1 §3.2.4) in api/index.ts.

export class ApiError extends Error {
  readonly code: string
  readonly retryAt?: string
  constructor(code: string, retryAt?: string) {
    super(code)
    this.code = code
    this.retryAt = retryAt
  }
}

export interface AuthApi {
  sendCode(phone: string): Promise<void>
  verifyCode(phone: string, code: string, role: Role): Promise<Session>
  currentSession(): Session | null
  signOut(): void
}

export interface RegisterBusinessInput {
  name: string
  registrationNo: string
  licenceNo: string
  branches: Branch[]
  documents: OrgDocument[]
}

export interface RegisterNgoInput {
  name: string
  registrationNo: string
  serviceAreas: Area[]
  foodTypes: FoodCategory[]
  capacityKgPerDay: number
  coordinatorPhones: string[]
  documents: OrgDocument[]
}

export interface OrganisationsApi {
  mine(ownerPhone: string): Promise<Organisation[]>
  registerBusiness(ownerPhone: string, input: RegisterBusinessInput): Promise<Organisation>
  registerNgo(ownerPhone: string, input: RegisterNgoInput): Promise<Organisation>
}

export interface AdminApi {
  listForReview(filter: VerificationStatus | 'all'): Promise<Organisation[]>
  get(id: string): Promise<Organisation | undefined>
  setVerification(id: string, status: VerificationStatus, adminPhone: string, reason?: string): Promise<Organisation>
}

export interface NotificationsApi {
  list(userPhone: string): Promise<AppNotification[]>
  markAllRead(userPhone: string): Promise<void>
}

export interface PortalApi {
  auth: AuthApi
  organisations: OrganisationsApi
  admin: AdminApi
  notifications: NotificationsApi
  resetDemo(): void
}
