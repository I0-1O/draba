/**
 * SettingsPage — shell with left-nav layout.
 *
 * Phase 10.1.1: lays the foundation for all settings sub-routes. The only
 * section that has content in this phase is the team list (which opens the
 * TeamModal). Profile, Tokens, and Admin sub-pages land in Phase 10.4.
 */

import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Key, Users, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const navLinkStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
  borderRadius: 7, fontSize: 13, color: active ? '#e6edf3' : '#8b949e',
  background: active ? '#2d333b' : 'none', textDecoration: 'none',
  cursor: 'pointer', border: 'none', width: '100%', fontFamily: 'inherit',
  fontWeight: active ? 500 : 400,
});

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: 'var(--font-sans, Inter, sans-serif)' }}>
      {/* Left nav */}
      <div style={{ width: 220, borderRight: '1px solid #30363d', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
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

        <Link to="/settings/profile" style={navLinkStyle(false)}>
          <User size={14} /> Profile
        </Link>
        <Link to="/settings/tokens" style={navLinkStyle(false)}>
          <Key size={14} /> API Tokens
        </Link>

        <div style={{ fontSize: 11, fontWeight: 600, color: '#484f58', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '4px 12px', marginTop: 12 }}>
          Teams
        </div>
        <Link to="/settings/teams" style={navLinkStyle(true)}>
          <Users size={14} /> Manage teams
        </Link>

        {user?.isSuperadmin && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#484f58', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '4px 12px', marginTop: 12 }}>
              Administration
            </div>
            <Link to="/settings/admin" style={navLinkStyle(false)}>
              <Shield size={14} /> Admin
            </Link>
          </>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, padding: '32px 40px', maxWidth: 800 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 13, color: '#8b949e' }}>
          Select a section from the left to manage your account and teams.
        </p>

        <div style={{ marginTop: 32, padding: 20, background: '#21262d', borderRadius: 10, border: '1px solid #30363d' }}>
          <div style={{ fontSize: 13, color: '#8b949e' }}>
            Profile, API Tokens, and Admin settings are coming in Phase 10.4. For now, use the team picker in the main app to create or edit teams.
          </div>
        </div>
      </div>
    </div>
  );
}
