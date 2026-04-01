import { useAtom, useSetAtom } from "jotai"
import { MoreHorizontal, Plus } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  agentsLoginModalOpenAtom,
  claudeLoginModalConfigAtom,
  hiddenModelsAtom,
  openaiApiKeyAtom,
} from "../../../lib/atoms"
import { ClaudeCodeIcon, CodexIcon, SearchIcon } from "../../ui/icons"
import { CLAUDE_MODELS, CODEX_MODELS } from "../../../features/agents/lib/models"
import { trpc } from "../../../lib/trpc"
import { Badge } from "../../ui/badge"
import { Button } from "../../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu"
import { Input } from "../../ui/input"
import { Label } from "../../ui/label"
import { Switch } from "../../ui/switch"
import { Textarea } from "../../ui/textarea"
import {
  ZAI_MODEL_SLOT_PRESETS,
} from "../../../../shared/zai-model-presets"

// Hook to detect narrow screen
function useIsNarrowScreen(): boolean {
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrow(window.innerWidth <= 768)
    }

    checkWidth()
    window.addEventListener("resize", checkWidth)
    return () => window.removeEventListener("resize", checkWidth)
  }, [])

  return isNarrow
}

// Account row component
function AccountRow({
  account,
  isActive,
  onSetActive,
  onRename,
  onRemove,
  isLoading,
}: {
  account: {
    id: string
    displayName: string | null
    email: string | null
    connectedAt: string | null
  }
  isActive: boolean
  onSetActive: () => void
  onRename: () => void
  onRemove: () => void
  isLoading: boolean
}) {
  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted/50">
      <div className="flex items-center gap-3">
        <div>
          <div className="text-sm font-medium">
            {account.displayName || "Anthropic Account"}
          </div>
          {account.email && (
            <div className="text-xs text-muted-foreground">{account.email}</div>
          )}
          {!account.email && account.connectedAt && (
            <div className="text-xs text-muted-foreground">
              Connected{" "}
              {new Date(account.connectedAt).toLocaleDateString(undefined, {
                dateStyle: "short",
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!isActive && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onSetActive}
            disabled={isLoading}
          >
            Switch
          </Button>
        )}
        {isActive && (
          <Badge variant="secondary" className="text-xs">
            Active
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
            <DropdownMenuItem
              className="data-[highlighted]:bg-red-500/15 data-[highlighted]:text-red-400"
              onClick={onRemove}
            >
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// Anthropic accounts section component
function AnthropicAccountsSection() {
  const { data: accounts, isLoading: isAccountsLoading, refetch: refetchList } =
    trpc.anthropicAccounts.list.useQuery(undefined, {
      refetchOnMount: true,
      staleTime: 0,
    })
  const { data: activeAccount, refetch: refetchActive } =
    trpc.anthropicAccounts.getActive.useQuery(undefined, {
      refetchOnMount: true,
      staleTime: 0,
    })
  const { data: claudeCodeIntegration } = trpc.claudeCode.getIntegration.useQuery()
  const trpcUtils = trpc.useUtils()

  // Auto-migrate legacy account if needed
  const migrateLegacy = trpc.anthropicAccounts.migrateLegacy.useMutation({
    onSuccess: async () => {
      await refetchList()
      await refetchActive()
    },
  })

  // Trigger migration if: no accounts, not loading, has legacy connection, not already migrating
  useEffect(() => {
    if (
      !isAccountsLoading &&
      accounts?.length === 0 &&
      claudeCodeIntegration?.isConnected &&
      !migrateLegacy.isPending &&
      !migrateLegacy.isSuccess
    ) {
      migrateLegacy.mutate()
    }
  }, [isAccountsLoading, accounts, claudeCodeIntegration, migrateLegacy])

  const setActiveMutation = trpc.anthropicAccounts.setActive.useMutation({
    onSuccess: () => {
      trpcUtils.anthropicAccounts.list.invalidate()
      trpcUtils.anthropicAccounts.getActive.invalidate()
      trpcUtils.claudeCode.getIntegration.invalidate()
      toast.success("Account switched")
    },
    onError: (err) => {
      toast.error(`Failed to switch account: ${err.message}`)
    },
  })

  const renameMutation = trpc.anthropicAccounts.rename.useMutation({
    onSuccess: () => {
      trpcUtils.anthropicAccounts.list.invalidate()
      trpcUtils.anthropicAccounts.getActive.invalidate()
      toast.success("Account renamed")
    },
    onError: (err) => {
      toast.error(`Failed to rename account: ${err.message}`)
    },
  })

  const removeMutation = trpc.anthropicAccounts.remove.useMutation({
    onSuccess: () => {
      trpcUtils.anthropicAccounts.list.invalidate()
      trpcUtils.anthropicAccounts.getActive.invalidate()
      trpcUtils.claudeCode.getIntegration.invalidate()
      toast.success("Account removed")
    },
    onError: (err) => {
      toast.error(`Failed to remove account: ${err.message}`)
    },
  })

  const handleRename = (accountId: string, currentName: string | null) => {
    const newName = window.prompt(
      "Enter new name for this account:",
      currentName || "Anthropic Account"
    )
    if (newName && newName.trim()) {
      renameMutation.mutate({ accountId, displayName: newName.trim() })
    }
  }

  const handleRemove = (accountId: string, displayName: string | null) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove "${displayName || "this account"}"? You will need to re-authenticate to use it again.`
    )
    if (confirmed) {
      removeMutation.mutate({ accountId })
    }
  }

  const isLoading =
    setActiveMutation.isPending ||
    renameMutation.isPending ||
    removeMutation.isPending

  // Don't show section if no accounts
  if (!isAccountsLoading && (!accounts || accounts.length === 0)) {
    return null
  }

  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden divide-y divide-border">
        {isAccountsLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading accounts...
          </div>
        ) : (
          accounts?.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              isActive={activeAccount?.id === account.id}
              onSetActive={() => setActiveMutation.mutate({ accountId: account.id })}
              onRename={() => handleRename(account.id, account.displayName)}
              onRemove={() => handleRemove(account.id, account.displayName)}
              isLoading={isLoading}
            />
          ))
        )}
    </div>
  )
}

export function AgentsModelsTab() {
  const setClaudeLoginModalConfig = useSetAtom(claudeLoginModalConfigAtom)
  const setClaudeLoginModalOpen = useSetAtom(agentsLoginModalOpenAtom)
  const isNarrowScreen = useIsNarrowScreen()
  const { data: claudeCodeIntegration, isLoading: isClaudeCodeLoading } =
    trpc.claudeCode.getIntegration.useQuery()
  const isClaudeCodeConnected = claudeCodeIntegration?.isConnected
  const [storedOpenAIKey, setStoredOpenAIKey] = useAtom(openaiApiKeyAtom)
  const [openaiKey, setOpenaiKey] = useState(storedOpenAIKey)
  const setOpenAIKeyMutation = trpc.voice.setOpenAIKey.useMutation()
  const trpcUtils = trpc.useUtils()
  const { data: providerPresets } = trpc.zai.listProviders.useQuery()
  const { data: activeProvider } = trpc.zai.getActiveProvider.useQuery()
  const { data: providerKeyStatus } = trpc.zai.getProviderKeyStatus.useQuery()
  const setActiveProviderMutation = trpc.zai.setActiveProvider.useMutation()
  const saveProviderKeyMutation = trpc.zai.saveProviderKey.useMutation()
  const saveProviderConfigMutation = trpc.zai.saveProviderConfig.useMutation()
  const [providerKeyDrafts, setProviderKeyDrafts] = useState<Record<string, string>>({})
  const [providerConfigDrafts, setProviderConfigDrafts] = useState<
    Record<
      string,
      {
        baseUrl: string
        heavy: string
        standard: string
        fast: string
        headersJson: string
      }
    >
  >({})

  useEffect(() => {
    setOpenaiKey(storedOpenAIKey)
  }, [storedOpenAIKey])

  useEffect(() => {
    if (!providerPresets) return
    setProviderKeyDrafts((prev) => {
      const next = { ...prev }
      for (const provider of providerPresets) {
        if (!(provider.id in next)) {
          next[provider.id] = ""
        }
      }
      return next
    })
    setProviderConfigDrafts((prev) => {
      const next = { ...prev }
      for (const provider of providerPresets) {
        next[provider.id] = {
          baseUrl: next[provider.id]?.baseUrl || provider.baseUrl,
          heavy: next[provider.id]?.heavy || provider.models.heavy,
          standard: next[provider.id]?.standard || provider.models.standard,
          fast: next[provider.id]?.fast || provider.models.fast,
          headersJson:
            next[provider.id]?.headersJson ||
            JSON.stringify(provider.defaultHeaders || {}, null, 2),
        }
      }
      return next
    })
  }, [providerPresets])

  const handleClaudeCodeSetup = () => {
    setClaudeLoginModalConfig({
      hideCustomModelSettingsLink: true,
      autoStartAuth: true,
    })
    setClaudeLoginModalOpen(true)
  }

  const [hiddenModels, setHiddenModels] = useAtom(hiddenModelsAtom)

  const toggleModelVisibility = useCallback((modelId: string) => {
    setHiddenModels((prev) => {
      if (prev.includes(modelId)) {
        return prev.filter((id) => id !== modelId)
      }
      return [...prev, modelId]
    })
  }, [setHiddenModels])

  // OpenAI key handlers
  const trimmedOpenAIKey = openaiKey.trim()
  const canResetOpenAI = !!trimmedOpenAIKey

  const handleSaveOpenAI = async () => {
    if (trimmedOpenAIKey === storedOpenAIKey) return // No change
    if (trimmedOpenAIKey && !trimmedOpenAIKey.startsWith("sk-")) {
      toast.error("Invalid OpenAI API key format. Key should start with 'sk-'")
      return
    }

    try {
      await setOpenAIKeyMutation.mutateAsync({ key: trimmedOpenAIKey })
      setStoredOpenAIKey(trimmedOpenAIKey)
      // Invalidate voice availability check
      await trpcUtils.voice.isAvailable.invalidate()
      toast.success("OpenAI API key saved")
    } catch (err) {
      toast.error("Failed to save OpenAI API key")
    }
  }

  const handleResetOpenAI = async () => {
    try {
      await setOpenAIKeyMutation.mutateAsync({ key: "" })
      setStoredOpenAIKey("")
      setOpenaiKey("")
      await trpcUtils.voice.isAvailable.invalidate()
      toast.success("OpenAI API key removed")
    } catch (err) {
      toast.error("Failed to remove OpenAI API key")
    }
  }

  // All models merged into one list for the top section
  const allModels = useMemo(() => {
    const items: { id: string; name: string; provider: "claude" | "codex" }[] = []
    for (const m of CLAUDE_MODELS) {
      items.push({ id: m.id, name: `${m.name} ${m.version}`, provider: "claude" })
    }
    for (const m of CODEX_MODELS) {
      items.push({ id: m.id, name: m.name, provider: "codex" })
    }
    return items
  }, [])

  const [modelSearch, setModelSearch] = useState("")
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return allModels
    const q = modelSearch.toLowerCase().trim()
    return allModels.filter((m) => m.name.toLowerCase().includes(q))
  }, [allModels, modelSearch])

  const handleSwitchProvider = async (presetId: string) => {
    try {
      await setActiveProviderMutation.mutateAsync({ presetId })
      await Promise.all([
        trpcUtils.zai.getActiveProvider.invalidate(),
        trpcUtils.zai.getProviderKeyStatus.invalidate(),
        trpcUtils.codex.getIntegration.invalidate(),
      ])
      toast.success("Active provider updated")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to switch provider"
      toast.error(message)
    }
  }

  const handleSaveProviderKey = async (presetId: string) => {
    const value = providerKeyDrafts[presetId]?.trim() || ""
    if (!value) {
      toast.error("Enter an API key before saving")
      return
    }

    try {
      await saveProviderKeyMutation.mutateAsync({ presetId, apiKey: value })
      setProviderKeyDrafts((prev) => ({ ...prev, [presetId]: "" }))
      await Promise.all([
        trpcUtils.zai.getProviderKeyStatus.invalidate(),
        trpcUtils.zai.getApiKey.invalidate(),
        trpcUtils.zai.isConfigured.invalidate(),
        trpcUtils.codex.getIntegration.invalidate(),
      ])
      toast.success("Provider API key saved")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save provider API key"
      toast.error(message)
    }
  }

  const handleUpdateProviderDraft = useCallback((
    presetId: string,
    patch: Partial<{
      baseUrl: string
      heavy: string
      standard: string
      fast: string
      headersJson: string
    }>,
  ) => {
    setProviderConfigDrafts((prev) => ({
      ...prev,
      [presetId]: {
        ...prev[presetId],
        ...patch,
      },
    }))
  }, [])

  const handleApplyZaiPreset = (presetId: string) => {
    const preset = ZAI_MODEL_SLOT_PRESETS.find((item) => item.id === presetId)
    if (!preset || !activeProvider) return

    handleUpdateProviderDraft(activeProvider.id, {
      heavy: preset.models.opus,
      standard: preset.models.sonnet,
      fast: preset.models.haiku,
    })
  }

  const handleSaveProviderConfig = async (presetId: string) => {
    const draft = providerConfigDrafts[presetId]
    if (!draft) return

    let parsedHeaders: Record<string, string> = {}
    try {
      const parsed = JSON.parse(draft.headersJson || "{}")
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Headers must be a JSON object")
      }

      parsedHeaders = Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, String(value)]),
      )
    } catch (error) {
      toast.error("Invalid headers JSON")
      return
    }

    try {
      await saveProviderConfigMutation.mutateAsync({
        presetId,
        baseUrl: draft.baseUrl.trim(),
        headers: parsedHeaders,
        models: {
          heavy: draft.heavy.trim(),
          standard: draft.standard.trim(),
          fast: draft.fast.trim(),
        },
      })
      await Promise.all([
        trpcUtils.zai.listProviders.invalidate(),
        trpcUtils.zai.getActiveProvider.invalidate(),
        trpcUtils.codex.getIntegration.invalidate(),
      ])
      toast.success("Provider config saved")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save provider config"
      toast.error(message)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      {!isNarrowScreen && (
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h3 className="text-sm font-semibold text-foreground">Models</h3>
        </div>
      )}

      <div className="space-y-2">
        <div className="pb-2">
          <h4 className="text-sm font-medium text-foreground">Providers</h4>
          <p className="text-xs text-muted-foreground">
            Choose the active provider, then edit its API key, base URL, model mapping, and headers in one place.
          </p>
        </div>

        <div className="bg-background rounded-lg border border-border p-4 space-y-5">
          <div className="flex flex-wrap gap-2">
            {providerPresets?.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => void handleSwitchProvider(provider.id)}
                className="rounded-md px-4 py-1.5 text-sm transition-colors"
                style={{
                  border:
                    activeProvider?.id === provider.id
                      ? "1px solid #cc2200"
                      : "1px solid #333",
                  color: activeProvider?.id === provider.id ? "#cc2200" : "#888",
                  background: "transparent",
                  cursor: "pointer",
                }}
                disabled={setActiveProviderMutation.isPending}
              >
                {provider.name}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Active: {activeProvider?.name || "Unknown"} · {activeProvider?.type || "unknown"}
          </p>

          {activeProvider && providerConfigDrafts[activeProvider.id] && (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm font-medium">
                      {activeProvider.apiKeyLabel}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {providerKeyStatus?.find((item) => item.presetId === activeProvider.id)?.hasKey
                        ? "Saved"
                        : "Not configured"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {activeProvider.type}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    value={providerKeyDrafts[activeProvider.id] || ""}
                    onChange={(e) =>
                      setProviderKeyDrafts((prev) => ({
                        ...prev,
                        [activeProvider.id]: e.target.value,
                      }))
                    }
                    placeholder={activeProvider.apiKeyPlaceholder}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleSaveProviderKey(activeProvider.id)}
                    disabled={saveProviderKeyMutation.isPending}
                  >
                    Save key
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Base URL</Label>
                <Input
                  value={providerConfigDrafts[activeProvider.id].baseUrl}
                  onChange={(e) =>
                    handleUpdateProviderDraft(activeProvider.id, {
                      baseUrl: e.target.value,
                    })
                  }
                  placeholder={activeProvider.baseUrl}
                />
              </div>

              {activeProvider.id === "zai" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Quick presets</Label>
                  <div className="flex gap-2">
                    {ZAI_MODEL_SLOT_PRESETS.map((preset) => (
                      <Button
                        key={preset.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyZaiPreset(preset.id)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Heavy</Label>
                  <Input
                    value={providerConfigDrafts[activeProvider.id].heavy}
                    onChange={(e) =>
                      handleUpdateProviderDraft(activeProvider.id, {
                        heavy: e.target.value,
                      })
                    }
                    placeholder={activeProvider.models.heavy}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Standard</Label>
                  <Input
                    value={providerConfigDrafts[activeProvider.id].standard}
                    onChange={(e) =>
                      handleUpdateProviderDraft(activeProvider.id, {
                        standard: e.target.value,
                      })
                    }
                    placeholder={activeProvider.models.standard}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Fast</Label>
                  <Input
                    value={providerConfigDrafts[activeProvider.id].fast}
                    onChange={(e) =>
                      handleUpdateProviderDraft(activeProvider.id, {
                        fast: e.target.value,
                      })
                    }
                    placeholder={activeProvider.models.fast}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Headers</Label>
                <Textarea
                  rows={6}
                  value={providerConfigDrafts[activeProvider.id].headersJson}
                  onChange={(e) =>
                    handleUpdateProviderDraft(activeProvider.id, {
                      headersJson: e.target.value,
                    })
                  }
                  placeholder='{"Host":"9router.colenboro.xyz","User-Agent":"curl/7.88.1"}'
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  9router should include `Host: 9router.colenboro.xyz` and `User-Agent: curl/7.88.1`.
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void handleSaveProviderConfig(activeProvider.id)}
                  disabled={saveProviderConfigMutation.isPending}
                >
                  {saveProviderConfigMutation.isPending ? "Saving..." : "Save Provider Config"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== Models Section ===== */}
      <div className="space-y-2">
        <div className="bg-background rounded-lg border border-border overflow-hidden">
          {/* Search */}
          <div className="px-1.5 pt-1.5 pb-0.5">
            <div className="flex items-center gap-1.5 h-7 px-1.5 rounded-md bg-muted/50">
              <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder="Add or search model"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Model list */}
          <div className="divide-y divide-border">
            {filteredModels.map((m) => {
              const isEnabled = !hiddenModels.includes(m.id)
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.name}</span>
                    {m.provider === "claude" ? (
                      <ClaudeCodeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <CodexIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => toggleModelVisibility(m.id)}
                  />
                </div>
              )
            })}
            {filteredModels.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No models found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Accounts Section ===== */}
      <div className="space-y-2">
        {/* Anthropic Accounts */}
        <div className="pb-2 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-foreground">
              Anthropic Accounts
            </h4>
            <p className="text-xs text-muted-foreground">
              Manage your Claude API accounts
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleClaudeCodeSetup}
            disabled={isClaudeCodeLoading}
          >
            <Plus className="h-3 w-3 mr-1" />
            {isClaudeCodeConnected ? "Add" : "Connect"}
          </Button>
        </div>

        <AnthropicAccountsSection />
      </div>

      <div className="space-y-2">
        <div className="pb-2">
          <h4 className="text-sm font-medium text-foreground">Voice</h4>
          <p className="text-xs text-muted-foreground">
            Configure the separate OpenAI key used for Whisper transcription.
          </p>
        </div>

        <div className="bg-background rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between gap-6 p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">OpenAI API Key</Label>
                {canResetOpenAI && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetOpenAI}
                    disabled={setOpenAIKeyMutation.isPending}
                    className="h-5 px-1.5 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Required for voice transcription (Whisper API)
              </p>
            </div>
            <div className="flex-shrink-0 w-80">
              <Input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                onBlur={handleSaveOpenAI}
                className="w-full"
                placeholder="sk-..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
