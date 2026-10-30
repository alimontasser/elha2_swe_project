import type { Role } from './types'

export const HOME_FOR_ROLE: Record<Role, string> = {
  businessOwner: '/organisation',
  ngoCoordinator: '/organisation',
  admin: '/admin',
}
