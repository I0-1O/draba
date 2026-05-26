/**
 * /settings/ai — Superadmin: AI / LLM API key configuration.
 * Stub for Phase 10.6 — AI Key Management. Key storage, model routing, and
 * usage tracking are deferred to that phase.
 */

import { Sparkles } from 'lucide-react'

export default function AiKeysPage() {
  return (
    <div>
      <h2 className="text-[17px] font-semibold text-foreground mb-1">AI / LLM Keys</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Connect AI providers to enable AI-assisted features in draba.
      </p>

      <div className="bg-card border border-border rounded-[10px] p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-[10px] bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">AI features coming in Phase 10.6</div>
            <div className="text-xs text-muted-foreground mt-0.5">Configure an API key when AI functionality is available.</div>
          </div>
        </div>

        <p className="text-[13px] text-muted-foreground mb-4">
          When AI features are enabled, you'll be able to add API keys for providers such as Anthropic, OpenAI, and others. Keys are stored encrypted and used only for organization-wide AI requests.
        </p>

        <div className="flex flex-col gap-2">
          {['Anthropic (Claude)', 'OpenAI (GPT)', 'Google (Gemini)', 'Custom / self-hosted'].map(provider => (
            <div
              key={provider}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-background opacity-50"
            >
              <span className="text-[13px] text-foreground">{provider}</span>
              <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded border border-border">
                Not configured
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
