import { describe, expect, it } from 'vitest'
import { backendProductReview } from './backendProducts'
import { createMockApi, memoryStore } from './mockApi'
import { ApiError } from './types'

const make = () => createMockApi({ store: memoryStore(), latencyMs: 0, now: () => new Date('2026-11-07T10:00:00Z') })

describe('product review, demo (US-2.03)', () => {
  it('lists by review state', async () => {
    const api = make()
    expect((await api.products.list('pending')).map((p) => p.barcode)).toEqual(['6221234500017'])
    expect((await api.products.list('aiAccepted')).map((p) => p.reviewedBy)).toEqual(['ai'])
    expect(await api.products.list('all')).toHaveLength(3)
  })

  it('an admin accepts with corrections, and the decision records who and when', async () => {
    const api = make()
    await api.products.decide('6221234500017', {
      decision: 'accept', nameAr: 'جبنة رومي', nameEn: 'Roumi cheese', category: 'dairy', catalogueId: 'roumi-cheese', quantity: 250, unit: 'g',
    })
    expect(await api.products.list('pending')).toHaveLength(0)
    const p = (await api.products.list('all')).find((x) => x.barcode === '6221234500017')
    expect(p).toMatchObject({ status: 'known', reviewedBy: 'admin', nameEn: 'Roumi cheese', quantity: 250, unit: 'g', reviewedAt: '2026-11-07T10:00:00.000Z' })
    expect(p).not.toHaveProperty('decision')
  })

  it('rejecting needs a reason and drops the shopper’s text', async () => {
    const api = make()
    await expect(api.products.decide('6221234500024', { decision: 'reject', note: ' ' })).rejects.toMatchObject({ code: 'reasonRequired' })
    await api.products.decide('6221234500024', { decision: 'reject', note: 'barcode is a different biscuit' })
    expect((await api.products.list('rejected')).find((x) => x.barcode === '6221234500024')).toMatchObject({ nameAr: null, reviewedBy: 'admin' })
  })
})

describe('product review over the backend', () => {
  function fakeFetch(status: number, body: unknown = {}) {
    const calls: { url: string; init: RequestInit }[] = []
    const fn = ((url: string, init: RequestInit) => {
      calls.push({ url, init })
      return Promise.resolve(new Response(JSON.stringify(body), { status }))
    }) as unknown as typeof fetch
    return { fn, calls }
  }

  it('sends the admin token, the filter and the decision', async () => {
    const { fn, calls } = fakeFetch(200, { items: [{ barcode: '6221234500017' }] })
    const api = backendProductReview('http://api/', async () => 'admin-token', fn)
    expect(await api.list('aiAccepted')).toEqual([{ barcode: '6221234500017' }])
    await api.decide('6221234500017', { decision: 'reject', note: 'not food' })
    expect(calls[0].url).toBe('http://api/api/v1/admin/products?status=aiAccepted')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer admin-token')
    expect(calls[1].url).toBe('http://api/api/v1/admin/products/6221234500017/decision')
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ decision: 'reject', note: 'not food' })
  })

  it('turns refusals into messages the page can show', async () => {
    const notAdmin = backendProductReview('http://api', async () => 't', fakeFetch(403).fn)
    await expect(notAdmin.list('pending')).rejects.toMatchObject({ code: 'notAdmin' })
    const noReason = backendProductReview('http://api', async () => 't', fakeFetch(400, { fieldErrors: { note: ['too small'] } }).fn)
    await expect(noReason.decide('6221234500017', { decision: 'reject', note: '' })).rejects.toBeInstanceOf(ApiError)
    await expect(noReason.decide('6221234500017', { decision: 'reject', note: '' })).rejects.toMatchObject({ code: 'reasonRequired' })
    const down = backendProductReview('http://api', async () => 't', (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch)
    await expect(down.list('pending')).rejects.toMatchObject({ code: 'unavailable' })
  })
})
