"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "../../components/ui/button"
import { ButtonGroup } from "../../components/ui/button-group"
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
import { ZAI_MODEL_SLOT_PRESETS } from "../../../shared/zai-model-presets"

const ZAI_MODELS = ["glm-5-turbo", "glm-5.1", "glm-5", "glm-4.7", "glm-4.5-air"]
const DEFAULT_BASE_URL = "https://api.z.ai/api/anthropic"

function isLikelyZaiKey(value: string) {
  const trimmed = value.trim()
  return trimmed.length >= 20 || trimmed.startsWith("zai") || trimmed.startsWith("glm")
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
  const [opusModel, setOpusModel] = useState("glm-4.7")
  const [sonnetModel, setSonnetModel] = useState("glm-4.7")
  const [haikuModel, setHaikuModel] = useState("glm-4.5-air")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!existingConfig) return
    setOpusModel(existingConfig.opusModel)
    setSonnetModel(existingConfig.sonnetModel)
    setHaikuModel(existingConfig.haikuModel)
  }, [existingConfig])

  const handleSubmit = async () => {
    if (!isLikelyZaiKey(apiKey)) {
      setError("API key khong hop le. Lay key tai z.ai/manage-apikey/apikey-list")
      return
    }

    setError("")

    try {
      await saveConfig.mutateAsync({
        apiKey: apiKey.trim(),
        baseUrl: DEFAULT_BASE_URL,
        opusModel,
        sonnetModel,
        haikuModel,
      })
      toast.success("ZAI config saved")
      onComplete()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Khong the luu ZAI config"
      setError(message)
    }
  }

  const applyModelSlotPreset = (presetId: string) => {
    const preset = ZAI_MODEL_SLOT_PRESETS.find((item) => item.id === presetId)
    if (!preset) return

    setOpusModel(preset.models.opus)
    setSonnetModel(preset.models.sonnet)
    setHaikuModel(preset.models.haiku)
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
              Nhap Z.AI API key de bat dau voi Claude Code-compatible GLM routing.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">ZAI API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleSubmit()
                }
              }}
              placeholder="Paste your ZAI API key"
              autoFocus
              disabled={saveConfig.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Lay key tai{" "}
              <a
                href="https://z.ai/manage-apikey/apikey-list"
                target="_blank"
                rel="noreferrer"
                className="text-foreground hover:underline"
              >
                z.ai/manage-apikey/apikey-list
              </a>
            </p>
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
              Claude Code se doc Base URL va 3 model slots tu ~/.claude/settings.json.
              De dung GLM Coding Plan, giu Base URL la https://api.z.ai/api/anthropic
              va map model nhu glm-5.1 / glm-5 / glm-5-turbo tuy nhu cau.
            </p>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Quick presets</Label>
              <ButtonGroup className="flex w-full [&>button]:flex-1">
                {ZAI_MODEL_SLOT_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyModelSlotPreset(preset.id)}
                    disabled={saveConfig.isPending}
                    title={preset.description}
                  >
                    {preset.label}
                  </Button>
                ))}
              </ButtonGroup>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Heavy tasks</Label>
              <Select value={opusModel} onValueChange={setOpusModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZAI_MODELS.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Standard tasks</Label>
              <Select value={sonnetModel} onValueChange={setSonnetModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZAI_MODELS.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fast tasks</Label>
              <Select value={haikuModel} onValueChange={setHaikuModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZAI_MODELS.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
