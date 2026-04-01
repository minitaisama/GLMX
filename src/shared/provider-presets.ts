export type ProviderType = "anthropic-compatible" | "openai-compatible"

export interface ProviderPreset {
  id: string
  name: string
  type: ProviderType
  baseUrl: string
  apiKeyLabel: string
  apiKeyPlaceholder: string
  defaultHeaders?: Record<string, string>
  models: {
    heavy: string
    standard: string
    fast: string
  }
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  zai: {
    id: "zai",
    name: "ZAI (GLM-5)",
    type: "anthropic-compatible",
    baseUrl: "https://api.z.ai/api/anthropic",
    apiKeyLabel: "ZAI API Key",
    apiKeyPlaceholder: "Paste your ZAI API key...",
    models: {
      heavy: "glm-5.1",
      standard: "glm-5-turbo",
      fast: "glm-4.5-air",
    },
  },

  "nine-router": {
    id: "nine-router",
    name: "9router",
    type: "openai-compatible",
    baseUrl: "https://9router.colenboro.xyz/v1",
    apiKeyLabel: "9router API Key",
    apiKeyPlaceholder: "Paste your 9router API key...",
    defaultHeaders: {
      Host: "9router.colenboro.xyz",
      "User-Agent": "curl/7.88.1",
    },
    models: {
      heavy: "gpt-4o",
      standard: "gpt-4o",
      fast: "gpt-4o-mini",
    },
  },
}

export const DEFAULT_PRESET_ID = "zai"
