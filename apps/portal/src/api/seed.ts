import type { AppNotification, Organisation } from '../domain/types'

export interface DemoDb {
  organisations: Organisation[]
  notifications: AppNotification[]
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

export const DEMO_ADMIN_PHONE = '01000000000'
export const DEMO_BUSINESS_PHONE = '01011112222'
export const DEMO_NGO_PHONE = '01233334444'

export function seedDb(): DemoDb {
  return {
    organisations: [
      {
        id: 'org-bakery',
        kind: 'business',
        name: 'مخبز الشمس',
        registrationNo: 'CR-118204',
        licenceNo: 'NFSA-55120',
        ownerPhone: DEMO_BUSINESS_PHONE,
        documents: [
          { kind: 'commercialRegistration', fileName: 'commercial-registration.pdf' },
          { kind: 'foodSafetyLicence', fileName: 'nfsa-licence.pdf' },
        ],
        branches: [
          { name: 'فرع التجمع', area: 'newCairo', address: 'التسعين الشمالي، مول ٥', opensAt: '07:00', closesAt: '23:00' },
          { name: 'فرع المعادي', area: 'maadi', address: 'شارع ٩', opensAt: '08:00', closesAt: '22:00' },
        ],
        verification: 'pending',
        history: [{ status: 'pending', at: daysAgo(1), byPhone: DEMO_BUSINESS_PHONE }],
        createdAt: daysAgo(1),
      },
      {
        id: 'org-ngo',
        kind: 'ngo',
        name: 'جمعية سلة الخير – المعادي',
        registrationNo: 'MOSS-2291',
        ownerPhone: DEMO_NGO_PHONE,
        documents: [{ kind: 'ngoRegistration', fileName: 'moss-registration.pdf' }],
        serviceAreas: ['maadi', 'newCairo', 'downtown'],
        foodTypes: ['bakery', 'produce', 'cooked', 'dry'],
        capacityKgPerDay: 250,
        coordinatorPhones: [DEMO_NGO_PHONE, '01277778888'],
        verification: 'pending',
        history: [{ status: 'pending', at: daysAgo(2), byPhone: DEMO_NGO_PHONE }],
        createdAt: daysAgo(2),
      },
      {
        id: 'org-cafe',
        kind: 'business',
        name: 'Zamalek Café',
        registrationNo: 'CR-90311',
        licenceNo: 'NFSA-40987',
        ownerPhone: '01155556666',
        documents: [
          { kind: 'commercialRegistration', fileName: 'cr.pdf' },
          { kind: 'foodSafetyLicence', fileName: 'licence.pdf' },
        ],
        branches: [{ name: 'Zamalek', area: 'zamalek', address: '26th of July St.', opensAt: '09:00', closesAt: '01:00' }],
        verification: 'verified',
        history: [
          { status: 'pending', at: daysAgo(9), byPhone: '01155556666' },
          { status: 'verified', at: daysAgo(8), byPhone: DEMO_ADMIN_PHONE },
        ],
        createdAt: daysAgo(9),
      },
    ],
    notifications: [],
  }
}
