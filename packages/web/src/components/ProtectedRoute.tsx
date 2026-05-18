/**
 * Wraps protected routes. Unauthenticated users are redirected to /login
 * with the original path preserved in state so they land back after logging in.
 * On a fresh install (no users exist) they are redirected to /setup instead.
 * Shows nothing while the session is being restored or the setup check is in flight.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { API_BASE } from '@/lib/api'

interface SetupStatus {
  needsSetup: boolean
}

export default function ProtectedRoute() {
  const { accessToken, initializing } = useAuth()
  const location = useLocation()

  // Only fetch setup status when the user isn't logged in — once setup is
  // done the result never changes back, so we cache it indefinitely.
  const { data: setup, isLoading: setupLoading } = useQuery<SetupStatus>({
    queryKey: ['setup-status'],
    queryFn: () =>
      fetch(`${API_BASE}/setup/status`).then(r => r.json()) as Promise<SetupStatus>,
    enabled: !initializing && !accessToken,
    staleTime: Infinity,
  })

  if (initializing || (!accessToken && setupLoading)) {
    return null
  }

  if (!accessToken) {
    if (setup?.needsSetup) {
      return <Navigate to="/setup" replace />
    }
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
