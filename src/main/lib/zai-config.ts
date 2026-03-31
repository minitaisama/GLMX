import { app } from "electron"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { logger } from "./logger"
import { getPresetById, inferPresetId } from "../../shared/provider-presets"

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json")
const ZAI_CONFIG_PATH = () => path.join(app.getPath("userData"), "zai-config.json")

export interface ZaiConfig {
  apiKey: string
  baseUrl: string
  customHeaders?: Record<string, string>
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

  const baseUrl = config?.baseUrl?.trim() || DEFAULT_ZAI_CONFIG.baseUrl
  const preset = getPresetById(inferPresetId(baseUrl))
  const customHeaders = normalizeHeaders(config?.customHeaders) || preset.headers

  return {
    apiKey,
    baseUrl,
    ...(customHeaders ? { customHeaders } : {}),
    opusModel: config?.opusModel?.trim() || DEFAULT_ZAI_CONFIG.opusModel,
    sonnetModel: config?.sonnetModel?.trim() || DEFAULT_ZAI_CONFIG.sonnetModel,
    haikuModel: config?.haikuModel?.trim() || DEFAULT_ZAI_CONFIG.haikuModel,
  }
}

function normalizeHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return undefined

  const normalizedEntries = Object.entries(headers)
    .map(([name, value]) => [name.trim(), value.trim()] as const)
    .filter(([name, value]) => Boolean(name) && value !== undefined)

  if (normalizedEntries.length === 0) return undefined
  return Object.fromEntries(normalizedEntries)
}

function serializeCustomHeaders(headers: Record<string, string> | undefined): string | undefined {
  const normalizedHeaders = normalizeHeaders(headers)
  if (!normalizedHeaders) return undefined

  return Object.entries(normalizedHeaders)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n")
}

function parseCustomHeaders(value: string | undefined): Record<string, string> | undefined {
  if (!value?.trim()) return undefined

  const entries = value
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(.*?)\s*:\s*(.*?)\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => [match[1], match[2]] as const)
    .filter(([name]) => Boolean(name))

  if (entries.length === 0) return undefined
  return Object.fromEntries(entries)
}

async function readClaudeSettings(): Promise<Record<string, unknown>> {
  return (await readJsonFile<Record<string, unknown>>(CLAUDE_SETTINGS_PATH)) || {}
}

async function writeClaudeSettings(settings: Record<string, unknown>): Promise<void> {
  await fs.mkdir(path.dirname(CLAUDE_SETTINGS_PATH), { recursive: true })
  await fs.writeFile(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8")
}

export async function getZaiConfig(): Promise<ZaiConfig | null> {
  logger.zai.info("Reading ZAI config")
  const storedConfig = await readJsonFile<Partial<ZaiConfig>>(ZAI_CONFIG_PATH())
  const normalizedStored = normalizeConfig(storedConfig)
  if (normalizedStored) {
    logger.zai.info("ZAI config loaded", {
      hasKey: true,
      baseUrl: normalizedStored.baseUrl,
      hasCustomHeaders: Boolean(normalizedStored.customHeaders),
      opusModel: normalizedStored.opusModel,
      sonnetModel: normalizedStored.sonnetModel,
      haikuModel: normalizedStored.haikuModel,
      source: "userData",
    })
    return normalizedStored
  }

  const claudeSettings = await readClaudeSettings()
  const env = (claudeSettings.env || {}) as Record<string, string | undefined>
  const normalized = normalizeConfig({
    apiKey: env.ANTHROPIC_AUTH_TOKEN,
    baseUrl: env.ANTHROPIC_BASE_URL,
    customHeaders: parseCustomHeaders(env.ANTHROPIC_CUSTOM_HEADERS),
    opusModel: env.ANTHROPIC_DEFAULT_OPUS_MODEL,
    sonnetModel: env.ANTHROPIC_DEFAULT_SONNET_MODEL,
    haikuModel: env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
  })
  logger.zai.info("ZAI config loaded", {
    hasKey: Boolean(normalized?.apiKey),
    baseUrl: normalized?.baseUrl || DEFAULT_ZAI_CONFIG.baseUrl,
    hasCustomHeaders: Boolean(normalized?.customHeaders),
    opusModel: normalized?.opusModel || DEFAULT_ZAI_CONFIG.opusModel,
    sonnetModel: normalized?.sonnetModel || DEFAULT_ZAI_CONFIG.sonnetModel,
    haikuModel: normalized?.haikuModel || DEFAULT_ZAI_CONFIG.haikuModel,
    source: "claude-settings",
  })
  return normalized
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

  logger.zai.info("Saving ZAI config", {
    baseUrl: normalized.baseUrl,
    hasCustomHeaders: Boolean(normalized.customHeaders),
    opusModel: normalized.opusModel,
    sonnetModel: normalized.sonnetModel,
    haikuModel: normalized.haikuModel,
  })

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
      ANTHROPIC_CUSTOM_HEADERS: serializeCustomHeaders(normalized.customHeaders),
      API_TIMEOUT_MS: "3000000",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      ANTHROPIC_DEFAULT_OPUS_MODEL: normalized.opusModel,
      ANTHROPIC_DEFAULT_SONNET_MODEL: normalized.sonnetModel,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: normalized.haikuModel,
    },
  }
  try {
    await writeClaudeSettings(updated)
    logger.zai.info("Written to ~/.claude/settings.json")
  } catch (error) {
    logger.zai.error("Failed to write settings.json", {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function isZaiConfigured(): Promise<boolean> {
  return Boolean(await getZaiApiKey())
}
