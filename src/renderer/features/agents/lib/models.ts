export const CLAUDE_MODELS = [
  { id: "opus", name: "Heavy", version: "slot" },
  { id: "sonnet", name: "Standard", version: "slot" },
  { id: "haiku", name: "Fast", version: "slot" },
]

export type CodexThinkingLevel = "low" | "medium" | "high" | "xhigh"

export const ENABLE_CODEX_PROVIDER = true

export const CODEX_MODELS = [
  {
    id: "heavy",
    name: "Heavy",
    thinkings: ["low", "medium", "high", "xhigh"] as CodexThinkingLevel[],
  },
  {
    id: "standard",
    name: "Standard",
    thinkings: ["low", "medium", "high", "xhigh"] as CodexThinkingLevel[],
  },
  {
    id: "fast",
    name: "Fast",
    thinkings: ["low", "medium"] as CodexThinkingLevel[],
  },
]

export function normalizeOpenAICompatibleModelId(
  modelId: string | null | undefined,
): string {
  if (!modelId) return "standard"

  const normalizedModel = modelId.trim().toLowerCase()
  const baseModel = normalizedModel.split("/")[0] || normalizedModel

  if (
    baseModel === "heavy" ||
    baseModel === "standard" ||
    baseModel === "fast"
  ) {
    return baseModel
  }

  if (baseModel.includes("mini") || baseModel.includes("fast")) {
    return "fast"
  }

  if (
    baseModel.includes("5.3") ||
    baseModel.includes("max") ||
    baseModel.includes("xhigh")
  ) {
    return "heavy"
  }

  return "standard"
}

export function formatCodexThinkingLabel(thinking: CodexThinkingLevel): string {
  if (thinking === "xhigh") return "Extra High"
  return thinking.charAt(0).toUpperCase() + thinking.slice(1)
}

export function getClaudeSlotModelName(
  slotId: string,
  config?: {
    opusModel?: string
    sonnetModel?: string
    haikuModel?: string
  } | null,
): string {
  switch (slotId) {
    case "opus":
      return config?.opusModel || "glm-5.1"
    case "sonnet":
      return config?.sonnetModel || "glm-5-turbo"
    case "haiku":
      return config?.haikuModel || "glm-4.5-air"
    default:
      return ""
  }
}

export function getOpenAICompatibleSlotModelName(
  slotId: string,
  config?: {
    heavy?: string
    standard?: string
    fast?: string
  } | null,
): string {
  switch (normalizeOpenAICompatibleModelId(slotId)) {
    case "heavy":
      return config?.heavy || "gpt-4o"
    case "standard":
      return config?.standard || "gpt-4o"
    case "fast":
      return config?.fast || "gpt-4o-mini"
    default:
      return ""
  }
}
