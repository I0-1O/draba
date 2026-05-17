/**
 * Thin fetch wrapper over the draba REST API.
 *
 * Token lifecycle:
 *   - Access token: kept in memory via the AuthContext; passed as Authorization header.
 *   - Refresh token: persisted in localStorage under REFRESH_TOKEN_KEY.
 *     On a 401, the client attempts one silent refresh then retries the original request.
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
    const body = (await res.json()) as ApiErrorBody
    return new ApiError(res.status, body.error.code, body.error.message)
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

/**
 * Higher-level wrapper that supplies the access token from a getter function.
 * Used by TanStack Query hooks so they never capture a stale token closure.
 */
export function createAuthFetch(getToken: () => string | null) {
  return function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    return apiFetch<T>(path, { ...init, accessToken: getToken() ?? undefined })
  }
}
