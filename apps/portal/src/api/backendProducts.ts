import type { ProductForReview } from '../domain/types'
import { ApiError, type ProductReviewApi } from './types'

/** The current login token: the Supabase session's, or a local dev token. */
export type TokenSource = () => Promise<string | null>

/** US-2.03 review over the NestJS API (GET /admin/products, POST /admin/products/:barcode/decision). */
export function backendProductReview(baseUrl: string, token: TokenSource, fetchFn: typeof fetch = (...a) => fetch(...a)): ProductReviewApi {
  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    let res: Response
    try {
      res = await fetchFn(`${baseUrl.replace(/\/$/, '')}/api/v1${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${(await token()) ?? ''}`, ...init.headers },
      })
    } catch {
      throw new ApiError('unavailable')
    }
    if (res.status === 401 || res.status === 403) throw new ApiError('notAdmin')
    if (res.status === 404) throw new ApiError('productNotFound')
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { fieldErrors?: Record<string, string[]> }
      throw new ApiError(body.fieldErrors?.note ? 'reasonRequired' : 'generic')
    }
    return res
  }

  return {
    async list(filter) {
      const res = await call(`/admin/products?status=${filter}`)
      return ((await res.json()) as { items: ProductForReview[] }).items
    },
    async decide(barcode, decision) {
      await call(`/admin/products/${barcode}/decision`, { method: 'POST', body: JSON.stringify(decision) })
    },
  }
}
