/**
 * Thin fetch wrapper over the draba REST API.
 *
 * Token lifecycle:
 *   - Access token: kept in memory via the AuthContext; passed as Authorization header.
 *   - Refresh token: persisted in localStorage under REFRESH_TOKEN_KEY.
 *     On a 401, the client attempts one silent refresh then retries the original request.
 *     Concurrent 401s share a single refresh call (mutex via in-flight promise).
 *     If refresh also fails, the registered logout handler is called and the user
 *     is redirected to /login.
 *
 * All callers receive typed JSON or throw an ApiError.
 */

import type { components } from '@draba/shared'

export type ApiErrorBody = components['schemas']['ApiError']

// Empty string = same-origin relative URLs, which is correct when the SPA is
// embedded in the Go binary. Set VITE_API_URL for local dev against a
// separate API server (e.g. VITE_API_URL=http://localhost:8080).
export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export const REFRESH_TOKEN_KEY = 'draba_refresh_token'

/** Thrown for any non-2xx response. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** Extra fields from the error response body (e.g. assignmentCount on 409). */
    public readonly data?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Reads the stored refresh token from localStorage. */
export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

/** Persists the refresh token to localStorage. */
export function storeRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

/** Removes the refresh token from localStorage (on logout). */
export function clearStoredRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody & Record<string, unknown>
    const { error, ...rest } = body
    const data = Object.keys(rest).length > 0 ? (rest as Record<string, unknown>) : undefined
    return new ApiError(res.status, error.code, error.message, data)
  } catch {
    return new ApiError(res.status, 'UNKNOWN', res.statusText)
  }
}

/** Low-level fetch that injects the access token and throws ApiError on non-2xx. */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, ...rest } = init
  const headers = new Headers(rest.headers)
  headers.set('Content-Type', 'application/json')
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers })

  if (!res.ok) {
    throw await parseError(res)
  }

  // 204 No Content — return undefined cast as T
  if (res.status === 204) {
    return undefined as unknown as T
  }

  return res.json() as Promise<T>
}

/** Extracts the filename from a Content-Disposition header, if present. */
function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null
  const match = /filename="?([^";]+)"?/.exec(header)
  return match ? match[1] : null
}

/** Low-level fetch for binary responses (file downloads). Throws ApiError on non-2xx. */
export async function apiFetchBlob(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<{ blob: Blob; filename: string | null }> {
  const { accessToken, ...rest } = init
  const headers = new Headers(rest.headers)
  headers.set('Content-Type', 'application/json')
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers })

  if (!res.ok) {
    throw await parseError(res)
  }

  return { blob: await res.blob(), filename: filenameFromContentDisposition(res.headers.get('Content-Disposition')) }
}

// ── Silent refresh ───────────────────────────────────────────────────────────

/**
 * Registered by AuthProvider on mount. Returns the new access token, or null
 * if the refresh token is expired/invalid (AuthProvider also handles logout
 * and redirect in that case).
 */
let _silentRefresh: (() => Promise<string | null>) | null = null

/** Mutex: if a refresh is already in flight, share it instead of firing a new one. */
let _refreshInFlight: Promise<string | null> | null = null

/** Called by AuthProvider to register the silent-refresh callback. */
export function configureSilentRefresh(fn: (() => Promise<string | null>) | null): void {
  _silentRefresh = fn
}

async function doSilentRefresh(): Promise<string | null> {
  if (!_silentRefresh) return null
  // Reuse an in-flight refresh instead of firing multiple simultaneous calls.
  if (!_refreshInFlight) {
    _refreshInFlight = _silentRefresh().finally(() => {
      _refreshInFlight = null
    })
  }
  return _refreshInFlight
}

/**
 * Higher-level wrapper that supplies the access token from a getter function.
 * On a 401, attempts one silent refresh and retries. If the refresh also fails,
 * the registered silentRefresh callback handles logout and redirect.
 *
 * Used by TanStack Query hooks so they never capture a stale token closure.
 */
export function createAuthFetch(getToken: () => string | null) {
  return async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    try {
      return await apiFetch<T>(path, { ...init, accessToken: getToken() ?? undefined })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && _silentRefresh) {
        const newToken = await doSilentRefresh()
        if (!newToken) throw err
        // Retry with the freshly-issued token.
        return apiFetch<T>(path, { ...init, accessToken: newToken })
      }
      throw err
    }
  }
}

/** Same silent-refresh behavior as createAuthFetch, for binary (blob) responses. */
export function createAuthFetchBlob(getToken: () => string | null) {
  return async function authFetchBlob(path: string, init: RequestInit = {}): Promise<{ blob: Blob; filename: string | null }> {
    try {
      return await apiFetchBlob(path, { ...init, accessToken: getToken() ?? undefined })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && _silentRefresh) {
        const newToken = await doSilentRefresh()
        if (!newToken) throw err
        return apiFetchBlob(path, { ...init, accessToken: newToken })
      }
      throw err
    }
  }
}
