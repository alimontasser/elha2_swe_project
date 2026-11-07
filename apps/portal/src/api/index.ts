import { createClient } from '@supabase/supabase-js'
import { browserStore, createMockApi } from './mockApi'
import { createSupabaseAuth, supabaseGateway } from './supabaseAuth'
import type { PortalApi } from './types'

// The one place the portal chooses its API implementations. Each real adapter is switched on by
// environment variables (apps/portal/.env.local); without them the demo mock is used.
//   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY   real phone sign-in (Supabase Auth)
// Organisations, verification and notifications stay on the mock until the backend serves them.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

const mock = createMockApi()

export const api: PortalApi =
  supabaseUrl && supabaseKey
    ? { ...mock, auth: createSupabaseAuth(supabaseGateway(createClient(supabaseUrl, supabaseKey)), browserStore()) }
    : mock

export * from './types'
