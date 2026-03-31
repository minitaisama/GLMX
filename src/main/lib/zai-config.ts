import { app } from "electron"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json")
const ZAI_CONFIG_PATH = () => path.join(app.getPath("userData"), "zai-config.json")

export interface ZaiConfig {
  apiKey: string
  baseUrl: string
  opusModel: string
  sonnetModel: string
  haikuModel: string
}

export const DEFAULT_ZAI_CONFIG = {
  baseUrl: "https://api.z.ai/api/anthropic",
  opusModel: "glm-4.7",
  sonnetModel: "glm-4.7",
  haikuModel: "glm-4.5-air",
} satisfies Omit<ZaiConfig, "apiKey">

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8")
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

function normalizeConfig(config: Partial<ZaiConfig> | null): ZaiConfig | null {
  const apiKey = config?.apiKey?.trim()
  if (!apiKey) return null

  return {
    apiKey,
    baseUrl: config?.baseUrl?.trim() || DEFAULT_ZAI_CONFIG.baseUrl,
    opusModel: config?.opusModel?.trim() || DEFAULT_ZAI_CONFIG.opusModel,
    sonnetModel: config?.sonnetModel?.trim() || DEFAULT_ZAI_CONFIG.sonnetModel,
    haikuModel: config?.haikuModel?.trim() || DEFAULT_ZAI_CONFIG.haikuModel,
  }
}

async function readClaudeSettings(): Promise<Record<string, unknown>> {
  return (await readJsonFile<Record<string, unknown>>(CLAUDE_SETTINGS_PATH)) || {}
}

async function writeClaudeSettings(settings: Record<string, unknown>): Promise<void> {
  await fs.mkdir(path.dirname(CLAUDE_SETTINGS_PATH), { recursive: true })
  await fs.writeFile(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8")
}

export async function getZaiConfig(): Promise<ZaiConfig | null> {
  const storedConfig = await readJsonFile<Partial<ZaiConfig>>(ZAI_CONFIG_PATH())
  const normalizedStored = normalizeConfig(storedConfig)
  if (normalizedStored) return normalizedStored

  const claudeSettings = await readClaudeSettings()
  const env = (claudeSettings.env || {}) as Record<string, string | undefined>
  return normalizeConfig({
    apiKey: env.ANTHROPIC_AUTH_TOKEN,
    baseUrl: env.ANTHROPIC_BASE_URL,
    opusModel: env.ANTHROPIC_DEFAULT_OPUS_MODEL,
    sonnetModel: env.ANTHROPIC_DEFAULT_SONNET_MODEL,
    haikuModel: env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
  })
}

export async function getZaiApiKey(): Promise<string | null> {
  const config = await getZaiConfig()
  return config?.apiKey || null
}

export async function getMaskedZaiKey(): Promise<string | null> {
  const apiKey = await getZaiApiKey()
  if (!apiKey) return null

  const visible = apiKey.slice(0, 8)
  return `${visible}${"*".repeat(Math.max(8, apiKey.length - visible.length))}`
}

export async function saveZaiConfig(config: ZaiConfig): Promise<void> {
  const normalized = normalizeConfig(config)
  if (!normalized) {
    throw new Error("Missing ZAI API key")
  }

  await fs.mkdir(path.dirname(ZAI_CONFIG_PATH()), { recursive: true })
  await fs.writeFile(ZAI_CONFIG_PATH(), JSON.stringify(normalized, null, 2), "utf-8")

  const existing = await readClaudeSettings()
  const env = ((existing.env as Record<string, string | undefined>) || {})

  const updated = {
    ...existing,
    env: {
      ...env,
      ANTHROPIC_AUTH_TOKEN: normalized.apiKey,
      ANTHROPIC_BASE_URL: normalized.baseUrl,
      API_TIMEOUT_MS: "3000000",
      ANTHROPIC_DEFAULT_OPUS_MODEL: normalized.opusModel,
      ANTHROPIC_DEFAULT_SONNET_MODEL: normalized.sonnetModel,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: normalized.haikuModel,
    },
  }

  await writeClaudeSettings(updated)
}

export async function isZaiConfigured(): Promise<boolean> {
  return Boolean(await getZaiApiKey())
}
