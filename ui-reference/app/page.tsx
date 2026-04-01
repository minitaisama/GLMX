"use client"

import { useState } from "react"
import { Onboarding } from "@/components/glmx/onboarding"
import { Sidebar } from "@/components/glmx/sidebar"
import { Workspace } from "@/components/glmx/workspace"
import { ModelSelector } from "@/components/glmx/model-selector"
import { Settings } from "@/components/glmx/settings"

type Screen = "onboarding" | "workspace" | "settings"

export default function GLMXApp() {
  const [screen, setScreen] = useState<Screen>("onboarding")
  const [activeChatId, setActiveChatId] = useState("c1")
  const [selectedModel, setSelectedModel] = useState("glm-4-plus")
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)

  if (screen === "onboarding") {
    return <Onboarding onConnect={() => setScreen("workspace")} />
  }

  if (screen === "settings") {
    return (
      <div className="h-screen w-screen overflow-hidden">
        <Settings onBack={() => setScreen("workspace")} />
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background">
      <Sidebar
        onOpenSettings={() => setScreen("settings")}
        onSelectChat={(id) => setActiveChatId(id)}
        activeChatId={activeChatId}
      />

      <main className="flex-1 min-w-0">
        <Workspace
          onOpenModelSelector={() => setModelSelectorOpen(true)}
          selectedModel={selectedModel}
        />
      </main>

      <ModelSelector
        isOpen={modelSelectorOpen}
        onClose={() => setModelSelectorOpen(false)}
        selectedModel={selectedModel}
        onSelect={(id) => setSelectedModel(id)}
      />
    </div>
  )
}
