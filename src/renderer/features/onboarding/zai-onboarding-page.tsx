"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Logo } from "../../components/ui/logo"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { trpc } from "../../lib/trpc"
import { rlog } from "../../lib/logger"
import {
  DEFAULT_PROVIDER_PRESET,
  getPresetById,
  inferPresetId,
  PROVIDER_PRESETS,
  type ProviderPresetId,
} from "../../../shared/provider-presets"

function isLikelyApiKey(value: string) {
  const trimmed = value.trim()
  return trimmed.length >= 10 || trimmed.startsWith("sk-") || trimmed.startsWith("zai")
}

export function ZaiOnboardingPage({
  onComplete,
}: {
  onComplete: () => void
}) {
  const { data: existingConfig } = trpc.zai.getConfig.useQuery()
  const saveConfig = trpc.zai.saveConfig.useMutation()

  const [apiKey, setApiKey] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [providerPreset, setProviderPreset] = useState<ProviderPresetId>(DEFAULT_PROVIDER_PRESET.id)
  const [baseUrl, setBaseUrl] = useState(DEFAULT_PROVIDER_PRESET.baseUrl)
  const [opusModel, setOpusModel] = useState("glm-4.7")
  const [sonnetModel, setSonnetModel] = useState("glm-4.7")
  const [haikuModel, setHaikuModel] = useState("glm-4.5-air")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!existingConfig) return
    setProviderPreset(inferPresetId(existingConfig.baseUrl))
    setBaseUrl(existingConfig.baseUrl)
    setOpusModel(existingConfig.opusModel)
    setSonnetModel(existingConfig.sonnetModel)
    setHaikuModel(existingConfig.haikuModel)
  }, [existingConfig])

  const handlePresetChange = (value: string) => {
    const nextPresetId = value as ProviderPresetId
    const preset = getPresetById(nextPresetId)

    setProviderPreset(nextPresetId)
    setBaseUrl(preset.baseUrl)

    if (nextPresetId !== "custom") {
      setOpusModel(preset.defaultModels.opus)
      setSonnetModel(preset.defaultModels.sonnet)
      setHaikuModel(preset.defaultModels.haiku)
    }
  }

  const handleSubmit = async () => {
    const normalizedBaseUrl = baseUrl.trim()
    const selectedPreset =
      providerPreset === "custom"
        ? getPresetById(inferPresetId(normalizedBaseUrl))
        : getPresetById(providerPreset)

    rlog.auth.info("User submitted API key", {
      hasKey: Boolean(apiKey.trim()),
      baseUrl: normalizedBaseUrl,
      customHeaders: selectedPreset.headers || null,
      opusModel,
      sonnetModel,
      haikuModel,
    })
    if (!isLikelyApiKey(apiKey)) {
      setError("API key khong hop le")
      return
    }

    if (!normalizedBaseUrl) {
      setError("Base URL khong duoc de trong")
      return
    }

    if (!opusModel.trim() || !sonnetModel.trim() || !haikuModel.trim()) {
      setError("Hay nhap day du model cho Heavy, Standard va Fast tasks")
      return
    }

    setError("")

    try {
      await saveConfig.mutateAsync({
        apiKey: apiKey.trim(),
        baseUrl: normalizedBaseUrl,
        customHeaders: selectedPreset.headers,
        opusModel: opusModel.trim(),
        sonnetModel: sonnetModel.trim(),
        haikuModel: haikuModel.trim(),
      })
      toast.success("Provider config saved")
      rlog.auth.info("Onboarding complete — entering workspace")
      onComplete()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Khong the luu provider config"
      rlog.auth.error("Config save failed", {
        error: err instanceof Error ? err.message : String(err),
      })
      setError(message)
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background select-none px-4">
      <div
        className="fixed top-0 left-0 right-0 h-10"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="w-full max-w-[460px] space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 p-2 mx-auto w-max rounded-full border border-border">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Logo className="w-5 h-5" fill="white" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-semibold tracking-tight">ZAI Agent</h1>
            <p className="text-sm text-muted-foreground">
              Nhap API key de bat dau voi model endpoint rieng cua ban.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleSubmit()
                }
              }}
              placeholder="Paste your API key"
              autoFocus
              disabled={saveConfig.isPending}
            />
          </div>

          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}

          <Button
            onClick={() => void handleSubmit()}
            className="w-full"
            disabled={!apiKey.trim() || saveConfig.isPending}
          >
            {saveConfig.isPending ? "Dang ket noi..." : "Start"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setShowAdvanced((current) => !current)}
          >
            {showAdvanced ? "An cai dat nang cao" : "Cai dat model nang cao"}
          </Button>
        </div>

        {showAdvanced ? (
          <div className="border border-border rounded-lg p-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Claude Code se doc Base URL va model mapping tu ~/.claude/settings.json.
            </p>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Preset</Label>
              <Select value={providerPreset} onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Base URL</Label>
              <Input
                value={baseUrl}
                onChange={(e) => {
                  setProviderPreset("custom")
                  setBaseUrl(e.target.value)
                }}
                placeholder="https://api.z.ai/api/anthropic"
                disabled={saveConfig.isPending}
              />
            </div>
            {getPresetById(
              providerPreset === "custom" ? inferPresetId(baseUrl) : providerPreset,
            ).headers ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Custom headers</Label>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
                  {Object.entries(
                    getPresetById(
                      providerPreset === "custom" ? inferPresetId(baseUrl) : providerPreset,
                    ).headers || {},
                  )
                    .map(([name, value]) => `${name}: ${value}`)
                    .join("\n")}
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Heavy tasks</Label>
              <Input
                value={opusModel}
                onChange={(e) => setOpusModel(e.target.value)}
                placeholder="glm-4.7"
                disabled={saveConfig.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Standard tasks</Label>
              <Input
                value={sonnetModel}
                onChange={(e) => setSonnetModel(e.target.value)}
                placeholder="glm-4.7"
                disabled={saveConfig.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fast tasks</Label>
              <Input
                value={haikuModel}
                onChange={(e) => setHaikuModel(e.target.value)}
                placeholder="glm-4.5-air"
                disabled={saveConfig.isPending}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
