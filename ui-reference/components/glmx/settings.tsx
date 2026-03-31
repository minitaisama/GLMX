"use client"

import { useState } from "react"
import { Eye, EyeOff, Save, RotateCcw, ChevronRight, Mic, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface ModelMapping {
  role: string
  label: string
  description: string
  model: string
}

const DEFAULT_MAPPINGS: ModelMapping[] = [
  {
    role: "opusModel",
    label: "Opus model",
    description: "Used for complex reasoning and heavy tasks.",
    model: "glm-5.1",
  },
  {
    role: "sonnetModel",
    label: "Sonnet model",
    description: "Used for general tasks and conversation.",
    model: "glm-5-turbo",
  },
  {
    role: "haikuModel",
    label: "Haiku model",
    description: "Used for lightweight operations and quick completions.",
    model: "glm-4.5-air",
  },
]

const AVAILABLE_MODELS = [
  "glm-5.1",
  "glm-5-turbo",
  "glm-4.5-air",
  "codegeex-4",
  "glm-4v-plus",
]

type SettingsTab = "zai" | "models" | "voice" | "interface"

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "zai", label: "ZAI Config" },
  { id: "models", label: "Model Mapping" },
  { id: "voice", label: "Voice / TTS" },
  { id: "interface", label: "Interface" },
]

interface SettingsProps {
  onBack: () => void
}

export function Settings({ onBack }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("zai")
  const [apiKey, setApiKey] = useState("sk-••••••••••••••••••••••••••••••••")
  const [showKey, setShowKey] = useState(false)
  const [baseUrl, setBaseUrl] = useState("https://api.z.ai/api/anthropic")
  const [mappings, setMappings] = useState<ModelMapping[]>(DEFAULT_MAPPINGS)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateMapping = (role: string, model: string) => {
    setMappings((prev) => prev.map((m) => (m.role === role ? { ...m, model } : m)))
  }

  return (
    <div className="flex h-full bg-background">
      {/* Settings sidebar */}
      <aside className="w-52 border-r border-border bg-sidebar shrink-0 flex flex-col">
        <div className="px-4 py-5 border-b border-sidebar-border">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <h2 className="text-sm font-semibold text-foreground tracking-tight">Settings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">GLMX configuration</p>
        </div>

        <nav className="flex-1 px-2 py-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors mb-0.5",
                activeTab === tab.id
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
              )}
            >
              {tab.label}
              {activeTab === tab.id && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ))}
        </nav>

        <div className="px-3 pb-4">
          <div className="bg-muted rounded-lg p-3 border border-border">
            <p className="text-[11px] font-medium text-foreground mb-0.5">GLMX v0.9.1</p>
            <p className="text-[11px] text-muted-foreground">ZAI · GLM model family</p>
          </div>
        </div>
      </aside>

      {/* Settings content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl px-8 py-8">
          {activeTab === "zai" && (
            <ZAIConfig
              apiKey={apiKey}
              setApiKey={setApiKey}
              showKey={showKey}
              setShowKey={setShowKey}
              baseUrl={baseUrl}
              setBaseUrl={setBaseUrl}
            />
          )}
          {activeTab === "models" && (
            <ModelMappingConfig mappings={mappings} updateMapping={updateMapping} />
          )}
          {activeTab === "voice" && <VoiceConfig />}
          {activeTab === "interface" && <InterfaceConfig />}
        </div>
      </main>

      {/* Save bar */}
      <div className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur-sm px-8 py-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Changes apply immediately.</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMappings(DEFAULT_MAPPINGS)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={handleSave}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
              saved
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-primary text-primary-foreground hover:opacity-90"
            )}
          >
            <Save className="w-3.5 h-3.5" />
            {saved ? "Saved" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── ZAI Config ── */
function ZAIConfig({
  apiKey, setApiKey, showKey, setShowKey, baseUrl, setBaseUrl,
}: {
  apiKey: string
  setApiKey: (v: string) => void
  showKey: boolean
  setShowKey: (v: boolean) => void
  baseUrl: string
  setBaseUrl: (v: string) => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">ZAI Configuration</h3>
        <p className="text-sm text-muted-foreground">Authentication and endpoint settings for the ZAI API.</p>
      </div>

      <SettingsSection title="Authentication">
        <SettingsField label="API Key" description="Your ZAI API key. Stored locally only.">
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3.5 py-2.5 pr-10 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title="Endpoint">
        <SettingsField label="Base URL" description="ZAI Anthropic-compatible API endpoint. Defaults: https://api.z.ai/api/anthropic">
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full bg-input border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          />
        </SettingsField>

        <SettingsField label="Timeout" description="Request timeout in seconds.">
          <input
            type="number"
            defaultValue={60}
            className="w-32 bg-input border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          />
        </SettingsField>
      </SettingsSection>
    </div>
  )
}

/* ── Model Mapping ── */
function ModelMappingConfig({
  mappings, updateMapping,
}: {
  mappings: ModelMapping[]
  updateMapping: (role: string, model: string) => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">Model Mapping</h3>
        <p className="text-sm text-muted-foreground">
          Assign specific GLM models to each agent role. Changes take effect on the next request.
        </p>
      </div>

      <SettingsSection title="Role assignments">
        {mappings.map((m) => (
          <SettingsField key={m.role} label={m.label} description={m.description}>
            <select
              value={m.model}
              onChange={(e) => updateMapping(m.role, e.target.value)}
              className="bg-input border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring transition-colors appearance-none cursor-pointer"
            >
              {AVAILABLE_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </SettingsField>
        ))}
      </SettingsSection>

      <div className="bg-muted border border-border rounded-lg p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-foreground font-medium">Tip:</span> Use GLM-4.5-Air for the haiku model to reduce latency on
          routine tasks, and GLM-5.1 for the opus model when accuracy matters most.
        </p>
      </div>
    </div>
  )
}

/* ── Voice Config ── */
function VoiceConfig() {
  const [enabled, setEnabled] = useState(false)

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">Voice & Transcription</h3>
        <p className="text-sm text-muted-foreground">Configure voice input and audio transcription settings.</p>
      </div>

      <SettingsSection title="Voice input">
        <SettingsField
          label="Enable voice input"
          description="Allow voice commands via microphone using a transcription provider."
        >
          <Toggle enabled={enabled} onChange={setEnabled} />
        </SettingsField>

        {enabled && (
          <>
            <SettingsField label="Transcription provider" description="Provider used for speech-to-text.">
              <select className="bg-input border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring transition-colors appearance-none cursor-pointer">
                <option value="glm">GLM Voice (ZAI)</option>
                <option value="whisper">OpenAI Whisper</option>
              </select>
            </SettingsField>

            <SettingsField label="Transcription API key" description="Required if using a third-party provider.">
              <input
                type="password"
                placeholder="sk-..."
                className="w-full bg-input border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
              />
            </SettingsField>

            <div className="pt-1">
              <button className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Mic className="w-3.5 h-3.5" />
                Test microphone
              </button>
            </div>
          </>
        )}
      </SettingsSection>
    </div>
  )
}

/* ── Interface Config ── */
function InterfaceConfig() {
  const [autoScroll, setAutoScroll] = useState(true)
  const [streamTokens, setStreamTokens] = useState(true)
  const [compactMode, setCompactMode] = useState(false)

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">Interface</h3>
        <p className="text-sm text-muted-foreground">Adjust workspace behavior and display preferences.</p>
      </div>

      <SettingsSection title="Chat behavior">
        <SettingsField label="Auto-scroll" description="Scroll to the latest message automatically.">
          <Toggle enabled={autoScroll} onChange={setAutoScroll} />
        </SettingsField>
        <SettingsField label="Stream tokens" description="Show tokens as they are generated.">
          <Toggle enabled={streamTokens} onChange={setStreamTokens} />
        </SettingsField>
        <SettingsField label="Compact mode" description="Reduce message padding for denser layouts.">
          <Toggle enabled={compactMode} onChange={setCompactMode} />
        </SettingsField>
      </SettingsSection>

      <SettingsSection title="Editor">
        <SettingsField label="Font size" description="Monospace font size in the diff and terminal views.">
          <select className="bg-input border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring transition-colors appearance-none cursor-pointer">
            <option value="12">12px</option>
            <option value="13" selected>13px</option>
            <option value="14">14px</option>
            <option value="15">15px</option>
          </select>
        </SettingsField>
      </SettingsSection>
    </div>
  )
}

/* ── Reusable primitives ── */
function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">{title}</h4>
      <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function SettingsField({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 px-5 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative w-9 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        enabled ? "bg-primary" : "bg-muted border border-border"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
          enabled ? "translate-x-4" : "translate-x-0.5"
        )}
      />
      <span className="sr-only">{enabled ? "Enabled" : "Disabled"}</span>
    </button>
  )
}
