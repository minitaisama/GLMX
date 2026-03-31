"use client"

import { useState } from "react"
import { Eye, EyeOff, ChevronDown, ChevronUp, ExternalLink, Zap } from "lucide-react"

interface OnboardingProps {
  onConnect: () => void
}

const MODEL_MAPPINGS = [
  { role: "default", model: "glm-4-plus" },
  { role: "weakModel", model: "glm-4-flash" },
  { role: "editorModel", model: "glm-4-long" },
]

export function Onboarding({ onConnect }: OnboardingProps) {
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [baseUrl, setBaseUrl] = useState("https://open.bigmodel.cn/api/paas/v4")
  const [isLoading, setIsLoading] = useState(false)

  const handleConnect = async () => {
    if (!apiKey.trim()) return
    setIsLoading(true)
    await new Promise((r) => setTimeout(r, 900))
    setIsLoading(false)
    onConnect()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.92 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.92 0 0) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo mark */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-foreground font-semibold text-lg tracking-tight">GLMX</span>
            <span className="text-muted-foreground text-sm">by ZAI</span>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-card border border-border rounded-xl p-8">
          <div className="mb-7">
            <h1 className="text-foreground text-xl font-semibold tracking-tight mb-1.5">Connect ZAI</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Enter your ZAI API key to start using GLM models locally.
            </p>
          </div>

          {/* API Key field */}
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-2 tracking-wide uppercase">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-input border border-border rounded-lg px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Get your key at{" "}
                <a
                  href="https://open.bigmodel.cn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 inline-flex items-center gap-0.5 transition-colors"
                >
                  open.bigmodel.cn
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            {/* Advanced settings toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Advanced settings
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 pt-4 border-t border-border">
                  {/* Base URL */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-2 tracking-wide uppercase">
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      className="w-full bg-input border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary/50 transition-colors"
                    />
                  </div>

                  {/* Model mappings */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-2 tracking-wide uppercase">
                      Model Mappings
                    </label>
                    <div className="bg-muted rounded-lg border border-border overflow-hidden">
                      {MODEL_MAPPINGS.map((m, i) => (
                        <div
                          key={m.role}
                          className={`flex items-center justify-between px-3.5 py-2.5 ${i < MODEL_MAPPINGS.length - 1 ? "border-b border-border" : ""}`}
                        >
                          <span className="text-xs text-muted-foreground font-mono">{m.role}</span>
                          <span className="text-xs text-primary font-mono">{m.model}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Customize model mappings in Settings after connecting.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* CTA */}
            <button
              type="button"
              onClick={handleConnect}
              disabled={!apiKey.trim() || isLoading}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold tracking-tight transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </button>
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Your key is stored locally and never transmitted to third parties.
        </p>
      </div>
    </div>
  )
}
