/**
 * SettingsPage — shell with left-nav and nested sub-routes.
 *
 * Phase 10.1.1: initial shell + Teams link.
 * Phase 10.1.3: full settings — Profile, Security, Preferences, API Tokens,
 * and Organization section (superadmin only): Organization, Communication,
 * Users, AI Keys (Phase 10.6 stub).
 */

import { Link, useLocation, Navigate, Routes, Route } from 'react-router-dom'
import { ArrowLeft, User, Settings, Key, Lock, MessageSquare, Users, Sparkles, Building2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import ProfilePage from '@/pages/settings/ProfilePage'
import SecurityPage from '@/pages/settings/SecurityPage'
import PreferencesPage from '@/pages/settings/PreferencesPage'
import TokensPage from '@/pages/settings/TokensPage'
import OrganizationPage from '@/pages/settings/OrganizationPage'
import CommunicationPage from '@/pages/settings/CommunicationPage'
import AdminUsersPage from '@/pages/settings/AdminUsersPage'
import AiKeysPage from '@/pages/settings/AiKeysPage'

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] no-underline cursor-pointer ${
        active
          ? 'bg-muted text-foreground font-medium'
          : 'text-muted-foreground font-normal hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname

  function isActive(prefix: string) {
    return path === prefix || path.startsWith(prefix + '/')
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      {/* Left nav */}
      <div className="w-[220px] border-r border-border px-3 py-4 flex flex-col gap-0.5 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-muted-foreground mb-3 bg-transparent border-none cursor-pointer w-full font-inherit hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to app
        </button>

        <div className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-[0.5px] px-3 py-1 mt-3">
          Account
        </div>

        <NavLink to="/settings/profile" active={isActive('/settings/profile')}>
          <User size={14} /> Profile
        </NavLink>
        <NavLink to="/settings/security" active={isActive('/settings/security')}>
          <Lock size={14} /> Security
        </NavLink>
        <NavLink to="/settings/preferences" active={isActive('/settings/preferences')}>
          <Settings size={14} /> Preferences
        </NavLink>
        <NavLink to="/settings/tokens" active={isActive('/settings/tokens')}>
          <Key size={14} /> API Tokens
        </NavLink>

        {user?.isSuperadmin && (
          <>
            <div className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-[0.5px] px-3 py-1 mt-3">
              Organization
            </div>
            <NavLink to="/settings/organization" active={isActive('/settings/organization')}>
              <Building2 size={14} /> Organization
            </NavLink>
            <NavLink to="/settings/communication" active={isActive('/settings/communication')}>
              <MessageSquare size={14} /> Communication
            </NavLink>
            <NavLink to="/settings/users" active={isActive('/settings/users')}>
              <Users size={14} /> Users
            </NavLink>
            <NavLink to="/settings/ai" active={isActive('/settings/ai')}>
              <Sparkles size={14} /> AI Keys
            </NavLink>
          </>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 px-10 py-8 max-w-[800px] min-w-0">
        <Routes>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="preferences" element={<PreferencesPage />} />
          <Route path="tokens" element={<TokensPage />} />
          <Route path="organization" element={user?.isSuperadmin ? <OrganizationPage /> : <Navigate to="/settings/profile" replace />} />
          <Route path="communication" element={user?.isSuperadmin ? <CommunicationPage /> : <Navigate to="/settings/profile" replace />} />
          <Route path="users" element={user?.isSuperadmin ? <AdminUsersPage /> : <Navigate to="/settings/profile" replace />} />
          <Route path="ai" element={user?.isSuperadmin ? <AiKeysPage /> : <Navigate to="/settings/profile" replace />} />
          {/* Legacy redirect: old /settings/admin deep links fall to organization */}
          <Route path="admin/*" element={user?.isSuperadmin ? <Navigate to="/settings/organization" replace /> : <Navigate to="/settings/profile" replace />} />
          <Route index element={<Navigate to="/settings/profile" replace />} />
          <Route path="*" element={<Navigate to="/settings/profile" replace />} />
        </Routes>
      </div>
    </div>
  )
}
