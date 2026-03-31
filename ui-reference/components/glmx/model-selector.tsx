"use client"

import { useState, useRef, useEffect } from "react"
import { Search, Check, X, Zap, Brain, Cpu, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

interface Model {
  id: string
  name: string
  context: string
  description: string
  tags: string[]
  speed: "fast" | "balanced" | "powerful"
}

interface ModelGroup {
  label: string
  icon: React.ReactNode
  models: Model[]
}

const MODEL_GROUPS: ModelGroup[] = [
  {
    label: "Flagship",
    icon: <Brain className="w-3.5 h-3.5" />,
    models: [
      {
        id: "glm-5.1",
        name: "GLM-5.1",
        context: "128k",
        description: "Most capable GLM model. Best for complex reasoning and code.",
        tags: ["code", "reasoning"],
        speed: "powerful",
      },
      {
        id: "glm-5-turbo",
        name: "GLM-5-Turbo",
        context: "128k",
        description: "Balanced performance. Ideal for general-purpose coding tasks.",
        tags: ["code"],
        speed: "balanced",
      },
    ],
  },
  {
    label: "Fast",
    icon: <Zap className="w-3.5 h-3.5" />,
    models: [
      {
        id: "glm-4.5-air",
        name: "GLM-4.5-Air",
        context: "128k",
        description: "Optimized for speed. Great for quick edits and completions.",
        tags: ["fast", "code"],
        speed: "fast",
      },
    ],
  },
  {
    label: "Specialized",
    icon: <Cpu className="w-3.5 h-3.5" />,
    models: [
      {
        id: "codegeex-4",
        name: "CodeGeeX-4",
        context: "128k",
        description: "Purpose-built for code generation and refactoring.",
        tags: ["code"],
        speed: "balanced",
      },
    ],
  },
  {
    label: "Vision",
    icon: <BookOpen className="w-3.5 h-3.5" />,
    models: [
      {
        id: "glm-4v-plus",
        name: "GLM-4V-Plus",
        context: "8k",
        description: "Multimodal reasoning with image understanding.",
        tags: ["vision", "multimodal"],
        speed: "balanced",
      },
    ],
  },
]

const SPEED_COLORS = {
  fast: "text-green-400",
  balanced: "text-primary",
  powerful: "text-amber-400",
}

const SPEED_LABELS = {
  fast: "Fast",
  balanced: "Balanced",
  powerful: "Powerful",
}

interface ModelSelectorProps {
  isOpen: boolean
  onClose: () => void
  selectedModel: string
  onSelect: (modelId: string) => void
}

export function ModelSelector({ isOpen, onClose, selectedModel, onSelect }: ModelSelectorProps) {
  const [query, setQuery] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50)
    } else {
      setQuery("")
    }
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const filteredGroups = MODEL_GROUPS.map((g) => ({
    ...g,
    models: g.models.filter(
      (m) =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.description.toLowerCase().includes(query.toLowerCase()) ||
        m.tags.some((t) => t.includes(query.toLowerCase()))
    ),
  })).filter((g) => g.models.length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Search header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search models..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded border border-border">
            ESC
          </kbd>
        </div>

        {/* Model list */}
        <div className="max-h-[420px] overflow-y-auto py-2">
          {filteredGroups.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No models match &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.label} className="mb-1">
                {/* Group label */}
                <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                  {group.icon}
                  {group.label}
                </div>

                {/* Models */}
                {group.models.map((model) => {
                  const isActive = selectedModel === model.id
                  return (
                    <button
                      key={model.id}
                      onClick={() => {
                        onSelect(model.id)
                        onClose()
                      }}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 transition-colors text-left",
                        isActive ? "bg-accent" : "hover:bg-muted"
                      )}
                    >
                      {/* Active check */}
                      <div className="mt-0.5 w-4 h-4 shrink-0 flex items-center justify-center">
                        {isActive && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>

                      {/* Model info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-foreground font-mono">{model.name}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono border border-border">
                            {model.context}
                          </span>
                          {model.tags.map((tag) => (
                            <span key={tag} className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{model.description}</p>
                      </div>

                      {/* Speed badge */}
                      <div className={cn("text-xs font-mono mt-0.5 shrink-0", SPEED_COLORS[model.speed])}>
                        {SPEED_LABELS[model.speed]}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">ZAI GLM model family</span>
          <span className="text-xs text-muted-foreground font-mono">{MODEL_GROUPS.flatMap((g) => g.models).length} models</span>
        </div>
      </div>
    </div>
  )
}
