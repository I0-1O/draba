/**
 * SettingsPage — shell with left-nav and nested sub-routes.
 *
 * Phase 10.1.1: initial shell + Teams link.
 * Phase 10.1.3: full settings experience — Profile, Security, Preferences,
 * API Tokens, and Admin (superadmin only).
 */

import { Link, useLocation, Outlet, Navigate } from 'react-router-dom'
import { ArrowLeft, User, Shield as ShieldIcon, Settings, Key, Users, Lock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import ProfilePage from '@/pages/settings/ProfilePage'
import SecurityPage from '@/pages/settings/SecurityPage'
import PreferencesPage from '@/pages/settings/PreferencesPage'
import TokensPage from '@/pages/settings/TokensPage'
import AdminPage from '@/pages/settings/AdminPage'
import { Routes, Route } from 'react-router-dom'

const navLinkStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
  borderRadius: 7, fontSize: 13, color: active ? '#e6edf3' : '#8b949e',
  background: active ? '#2d333b' : 'none', textDecoration: 'none',
  cursor: 'pointer', border: 'none', width: '100%', fontFamily: 'inherit',
  fontWeight: active ? 500 : 400,
})

export default function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname

  function isActive(prefix: string) {
    return path === prefix || path.startsWith(prefix + '/')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: 'var(--font-sans, Inter, sans-serif)' }}>
      {/* Left nav */}
      <div style={{ width: 220, borderRight: '1px solid #30363d', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
        <button
          onClick={() => navigate('/')}
          style={{ ...navLinkStyle(false), marginBottom: 12, color: '#8b949e' }}
        >
          <ArrowLeft size={14} />
          Back to app
        </button>

        <div style={{ fontSize: 11, fontWeight: 600, color: '#484f58', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '4px 12px', marginTop: 4 }}>
          Account
        </div>

        <Link to="/settings/profile" style={navLinkStyle(isActive('/settings/profile'))}>
          <User size={14} /> Profile
        </Link>
        <Link to="/settings/security" style={navLinkStyle(isActive('/settings/security'))}>
          <Lock size={14} /> Security
        </Link>
        <Link to="/settings/preferences" style={navLinkStyle(isActive('/settings/preferences'))}>
          <Settings size={14} /> Preferences
        </Link>
        <Link to="/settings/tokens" style={navLinkStyle(isActive('/settings/tokens'))}>
          <Key size={14} /> API Tokens
        </Link>

        <div style={{ fontSize: 11, fontWeight: 600, color: '#484f58', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '4px 12px', marginTop: 12 }}>
          Teams
        </div>
        <Link to="/settings/teams" style={navLinkStyle(isActive('/settings/teams'))}>
          <Users size={14} /> Manage teams
        </Link>

        {user?.isSuperadmin && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#484f58', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '4px 12px', marginTop: 12 }}>
              Administration
            </div>
            <Link to="/settings/admin" style={navLinkStyle(isActive('/settings/admin'))}>
              <ShieldIcon size={14} /> Admin
            </Link>
          </>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, padding: '32px 40px', maxWidth: 800, minWidth: 0 }}>
        <Routes>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="preferences" element={<PreferencesPage />} />
          <Route path="tokens" element={<TokensPage />} />
          <Route path="admin/*" element={user?.isSuperadmin ? <AdminPage /> : <Navigate to="/settings/profile" replace />} />
          <Route path="teams" element={<TeamsPlaceholder />} />
          <Route index element={<Navigate to="/settings/profile" replace />} />
          <Route path="*" element={<Navigate to="/settings/profile" replace />} />
        </Routes>
      </div>
    </div>
  )
}

function TeamsPlaceholder() {
  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>Manage Teams</h2>
      <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 24 }}>
        Use the team picker in the main app to create or edit teams.
      </p>
    </div>
  )
}
