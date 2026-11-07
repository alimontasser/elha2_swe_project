import { createClient } from '@supabase/supabase-js'
import { backendProductReview, type TokenSource } from './backendProducts'
import { browserStore, createMockApi } from './mockApi'
import { createSupabaseAuth, supabaseGateway } from './supabaseAuth'
import type { PortalApi } from './types'

// The one place the portal chooses its API implementations. Each real adapter is switched on by
// environment variables (apps/portal/.env.local); without them the demo mock is used.
//   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY   real phone sign-in (Supabase Auth)
//   VITE_API_URL                                       the NestJS backend (product review so far)
//   VITE_API_DEV_TOKEN                                 a local admin token when Supabase is off
// Organisations, verification and notifications stay on the mock until the backend serves them.
const env = import.meta.env as Record<string, string | undefined>
const supabase = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY) : null

const token: TokenSource = supabase
  ? async () => (await supabase.auth.getSession()).data.session?.access_token ?? null
  : async () => env.VITE_API_DEV_TOKEN ?? null

const mock = createMockApi()

export const api: PortalApi = {
  ...mock,
  ...(supabase ? { auth: createSupabaseAuth(supabaseGateway(supabase), browserStore()) } : {}),
  ...(env.VITE_API_URL ? { products: backendProductReview(env.VITE_API_URL, token) } : {}),
}

export * from './types'
