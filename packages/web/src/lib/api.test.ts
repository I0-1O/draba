/**
 * Tests for the 401 silent-refresh interceptor in api.ts.
 *
 * We mock globalThis.fetch so no real HTTP is made. The module-level
 * _silentRefresh / _refreshInFlight state is reset between tests via
 * configureSilentRefresh(null).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  configureSilentRefresh,
  createAuthFetch,
  createAuthFetchBlob,
} from './api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch')
  // Always reset the registered callback so tests don't bleed into each other.
  configureSilentRefresh(null)
})

afterEach(() => {
  vi.restoreAllMocks()
  configureSilentRefresh(null)
})

// ── createAuthFetch — happy path ──────────────────────────────────────────────

describe('createAuthFetch', () => {
  it('returns parsed JSON on a 200 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okResponse({ hello: 'world' }))

    const authFetch = createAuthFetch(() => 'token-abc')
    const result = await authFetch<{ hello: string }>('/test')

    expect(result).toEqual({ hello: 'world' })
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
  })

  it('throws ApiError on a non-401 failure without retrying', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(errorResponse(403, 'FORBIDDEN', 'No access'))

    const silentRefresh = vi.fn()
    configureSilentRefresh(silentRefresh)
    const authFetch = createAuthFetch(() => 'token-abc')

    await expect(authFetch('/test')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    expect(silentRefresh).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledOnce()
  })

  // ── 401 retry behaviour ───────────────────────────────────────────────────

  it('on 401: calls silentRefresh, then retries with the new token', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED', 'Expired'))
      .mockResolvedValueOnce(okResponse({ ok: true }))

    const silentRefresh = vi.fn().mockResolvedValue('new-token')
    configureSilentRefresh(silentRefresh)
    const authFetch = createAuthFetch(() => 'old-token')

    const result = await authFetch<{ ok: boolean }>('/protected')

    expect(result).toEqual({ ok: true })
    expect(silentRefresh).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledTimes(2)
    // Second call should carry the new token.
    const secondCall = vi.mocked(fetch).mock.calls[1]
    const secondHeaders = secondCall[1]?.headers as Headers
    expect(secondHeaders.get('Authorization')).toBe('Bearer new-token')
  })

  it('on 401: if silentRefresh returns null, re-throws the original 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED', 'Expired'))

    const silentRefresh = vi.fn().mockResolvedValue(null)
    configureSilentRefresh(silentRefresh)
    const authFetch = createAuthFetch(() => 'old-token')

    await expect(authFetch('/protected')).rejects.toMatchObject({ status: 401 })
    // No retry attempted after null token.
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('on 401: with no silentRefresh registered, throws immediately without retry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED', 'Expired'))

    // No configureSilentRefresh call — _silentRefresh stays null.
    const authFetch = createAuthFetch(() => 'token')

    await expect(authFetch('/protected')).rejects.toMatchObject({ status: 401 })
    expect(fetch).toHaveBeenCalledOnce()
  })

  // ── configureSilentRefresh teardown ──────────────────────────────────────

  it('configureSilentRefresh(null) disables the interceptor after registration', async () => {
    const silentRefresh = vi.fn().mockResolvedValue('new-token')
    configureSilentRefresh(silentRefresh)
    configureSilentRefresh(null) // immediately de-register

    vi.mocked(fetch).mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED', 'Expired'))

    const authFetch = createAuthFetch(() => 'token')
    await expect(authFetch('/test')).rejects.toMatchObject({ status: 401 })
    // silentRefresh must NOT have been called — it was de-registered.
    expect(silentRefresh).not.toHaveBeenCalled()
  })
})

// ── createAuthFetchBlob — content-type guard ─────────────────────────────────

describe('createAuthFetchBlob', () => {
  it('returns the blob and Content-Disposition filename on a real file response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Title,Start,End\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="draba-import-template.csv"',
      },
    }))

    const authFetchBlob = createAuthFetchBlob(() => 'token-abc')
    const { blob, filename } = await authFetchBlob('/import/template.csv')

    expect(filename).toBe('draba-import-template.csv')
    expect(await blob.text()).toBe('Title,Start,End\n')
  })

  it('throws NOT_A_FILE on a 200 text/html response (SPA fallback)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('<!doctype html><html></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }))

    const authFetchBlob = createAuthFetchBlob(() => 'token-abc')

    await expect(authFetchBlob('/import/template.csv')).rejects.toMatchObject({
      status: 200,
      code: 'NOT_A_FILE',
    })
  })
})

// ── ApiError ──────────────────────────────────────────────────────────────────

describe('ApiError', () => {
  it('is instanceof ApiError', () => {
    const err = new ApiError(404, 'NOT_FOUND', 'missing')
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
  })
})
