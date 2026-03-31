export type ProviderPresetId = "zai" | "9router" | "custom"

export interface ProviderPreset {
  id: ProviderPresetId
  label: string
  baseUrl: string
  headers?: Record<string, string>
  defaultModels: {
    opus: string
    sonnet: string
    haiku: string
  }
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "zai",
    label: "ZAI",
    baseUrl: "https://api.z.ai/api/anthropic",
    defaultModels: {
      opus: "glm-4.7",
      sonnet: "glm-4.7",
      haiku: "glm-4.5-air",
    },
  },
  {
    id: "9router",
    label: "9Router",
    baseUrl: "https://9router.colenboro.xyz/v1",
    headers: {
      Host: "9router.colenboro.xyz",
      "User-Agent": "curl/7.88.1",
    },
    defaultModels: {
      opus: "gpt",
      sonnet: "gpt",
      haiku: "gpt",
    },
  },
  {
    id: "custom",
    label: "Custom",
    baseUrl: "",
    defaultModels: {
      opus: "",
      sonnet: "",
      haiku: "",
    },
  },
]

export const DEFAULT_PROVIDER_PRESET = PROVIDER_PRESETS[0]

export function getPresetById(id: ProviderPresetId): ProviderPreset {
  return PROVIDER_PRESETS.find((preset) => preset.id === id) || DEFAULT_PROVIDER_PRESET
}

export function inferPresetId(baseUrl: string): ProviderPresetId {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "")

  const matchedPreset = PROVIDER_PRESETS.find((preset) => {
    if (!preset.baseUrl) return false
    return preset.baseUrl.replace(/\/+$/, "") === normalizedBaseUrl
  })

  return matchedPreset?.id || "custom"
}
