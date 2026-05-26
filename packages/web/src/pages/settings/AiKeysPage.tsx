/**
 * /settings/ai — Superadmin: AI / LLM API key configuration.
 * Stub for Phase 10.1.3 — key storage and model wiring are deferred.
 */

import { Sparkles } from 'lucide-react'

const sectionStyle: React.CSSProperties = {
  background: '#21262d',
  border: '1px solid #30363d',
  borderRadius: 10,
  padding: '24px',
  marginBottom: 20,
}

export default function AiKeysPage() {
  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>AI / LLM Keys</h2>
      <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 24 }}>
        Connect AI providers to enable AI-assisted features in draba.
      </p>

      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} style={{ color: '#58a6ff' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e6edf3' }}>AI features coming soon</div>
            <div style={{ fontSize: 12, color: '#8b949e', marginTop: 2 }}>Configure an API key when AI functionality is available.</div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 16 }}>
          When AI features are enabled, you'll be able to add API keys for providers such as Anthropic, OpenAI, and others. Keys are stored encrypted and used only for organization-wide AI requests.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['Anthropic (Claude)', 'OpenAI (GPT)', 'Google (Gemini)', 'Custom / self-hosted'].map(provider => (
            <div
              key={provider}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #30363d',
                background: '#161b22',
                opacity: 0.5,
              }}
            >
              <span style={{ fontSize: 13, color: '#e6edf3' }}>{provider}</span>
              <span style={{ fontSize: 11, color: '#8b949e', padding: '2px 8px', borderRadius: 4, border: '1px solid #30363d' }}>
                Not configured
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
