// Domain types mirror the SDD v1.1 data dictionary (Organisation, Business, Branch, NGO, Notification).

export type Role = 'businessOwner' | 'ngoCoordinator' | 'admin'

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'infoRequested'

export type FoodCategory = 'bakery' | 'produce' | 'dairy' | 'meat' | 'cooked' | 'dry' | 'drinks'

export const FOOD_CATEGORIES: FoodCategory[] = ['bakery', 'produce', 'dairy', 'meat', 'cooked', 'dry', 'drinks']

export const CAIRO_AREAS = [
  'newCairo',
  'maadi',
  'zamalek',
  'heliopolis',
  'nasrCity',
  'dokki',
  'mohandessin',
  'sheikhZayed',
  'october',
  'downtown',
] as const
export type Area = (typeof CAIRO_AREAS)[number]

export type DocumentKind = 'commercialRegistration' | 'foodSafetyLicence' | 'ngoRegistration'

export interface OrgDocument {
  kind: DocumentKind
  fileName: string
}

export interface VerificationEvent {
  status: VerificationStatus
  at: string
  byPhone: string
  reason?: string
}

export interface Branch {
  name: string
  area: Area
  address: string
  opensAt: string
  closesAt: string
}

interface OrganisationBase {
  id: string
  name: string
  registrationNo: string
  ownerPhone: string
  documents: OrgDocument[]
  verification: VerificationStatus
  history: VerificationEvent[]
  createdAt: string
}

export interface Business extends OrganisationBase {
  kind: 'business'
  licenceNo: string
  branches: Branch[]
}

export interface Ngo extends OrganisationBase {
  kind: 'ngo'
  serviceAreas: Area[]
  foodTypes: FoodCategory[]
  capacityKgPerDay: number
  coordinatorPhones: string[]
}

export type Organisation = Business | Ngo

export type NotificationType = 'orgVerified' | 'orgRejected' | 'orgInfoRequested' | 'orgSubmitted'

export interface AppNotification {
  id: string
  userPhone: string
  type: NotificationType
  orgName: string
  reason?: string
  deepLink: string
  sentAt: string
  readAt?: string
}

export interface Session {
  phone: string
  role: Role
}
