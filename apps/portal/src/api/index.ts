import { createMockApi } from './mockApi'
import type { PortalApi } from './types'

// The one place the portal chooses its API implementation.
// Sprint 1 demo: everything is mocked. Real build: Supabase Auth + NestJS /api/v1 adapters.
export const api: PortalApi = createMockApi()

export * from './types'
