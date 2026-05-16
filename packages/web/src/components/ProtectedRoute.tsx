import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Wraps protected routes. Unauthenticated users are redirected to /login
 * with the original path preserved in state so they land back after logging in.
 * Shows nothing while the session is being restored on initial mount.
 */
export default function ProtectedRoute() {
  const { accessToken, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return null
  }

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
