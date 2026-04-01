import { app } from "electron"
import fsSync from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  DEFAULT_PRESET_ID,
  PROVIDER_PRESETS,
  type ProviderPreset,
} from "../../shared/provider-presets"
import { logger } from "./logger"

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json")
const ZAI_CONFIG_PATH = () => path.join(app.getPath("userData"), "zai-config.json")

export interface ZaiConfig {
  apiKey: string
  baseUrl: string
  opusModel: string
  sonnetModel: string
  haikuModel: string
  activeProvider?: string
  providerApiKeys?: Record<string, string>
  providerConfigs?: Record<string, ProviderConfig>
}

export interface ProviderConfig {
  baseUrl?: string
  headers?: Record<string, string>
  models?: {
    heavy?: string
    standard?: string
    fast?: string
  }
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

function readJsonFileSync<T>(filePath: string): T | null {
  try {
    const content = fsSync.readFileSync(filePath, "utf-8")
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

function readClaudeSettingsSync(): Record<string, unknown> {
  return readJsonFileSync<Record<string, unknown>>(CLAUDE_SETTINGS_PATH) || {}
}

function writeClaudeSettingsSync(settings: Record<string, unknown>): void {
  fsSync.mkdirSync(path.dirname(CLAUDE_SETTINGS_PATH), { recursive: true })
  fsSync.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8")
}

function readStoredZaiConfigSync(): Partial<ZaiConfig> | null {
  return readJsonFileSync<Partial<ZaiConfig>>(ZAI_CONFIG_PATH())
}

function writeZaiConfig(config: Partial<ZaiConfig>): void {
  fsSync.mkdirSync(path.dirname(ZAI_CONFIG_PATH()), { recursive: true })
  fsSync.writeFileSync(ZAI_CONFIG_PATH(), JSON.stringify(config, null, 2), "utf-8")
}

function mergeProviderPreset(
  preset: ProviderPreset,
  override?: ProviderConfig,
): ProviderPreset {
  return {
    ...preset,
    baseUrl: override?.baseUrl?.trim() || preset.baseUrl,
    defaultHeaders: override?.headers || preset.defaultHeaders,
    models: {
      heavy: override?.models?.heavy?.trim() || preset.models.heavy,
      standard: override?.models?.standard?.trim() || preset.models.standard,
      fast: override?.models?.fast?.trim() || preset.models.fast,
    },
  }
}

export function readZaiConfig(): Partial<ZaiConfig> | null {
  logger.app.info("zai_config_read_started")
  const storedConfig = readStoredZaiConfigSync()
  if (storedConfig) {
    logger.app.info("zai_config_loaded", {
      hasKey: Boolean(storedConfig.apiKey),
      baseUrl: storedConfig.baseUrl,
      opusModel: storedConfig.opusModel,
      sonnetModel: storedConfig.sonnetModel,
      haikuModel: storedConfig.haikuModel,
    })
    return storedConfig
  }

  const claudeSettings = readClaudeSettingsSync()
  const env = (claudeSettings.env || {}) as Record<string, string | undefined>
  const fallbackKey = env.ANTHROPIC_AUTH_TOKEN?.trim()

  if (!fallbackKey) {
    return null
  }

  const config = {
    apiKey: fallbackKey,
    baseUrl: env.ANTHROPIC_BASE_URL?.trim() || DEFAULT_ZAI_CONFIG.baseUrl,
    opusModel:
      env.ANTHROPIC_DEFAULT_OPUS_MODEL?.trim() || DEFAULT_ZAI_CONFIG.opusModel,
    sonnetModel:
      env.ANTHROPIC_DEFAULT_SONNET_MODEL?.trim() || DEFAULT_ZAI_CONFIG.sonnetModel,
    haikuModel:
      env.ANTHROPIC_DEFAULT_HAIKU_MODEL?.trim() || DEFAULT_ZAI_CONFIG.haikuModel,
    activeProvider: DEFAULT_PRESET_ID,
    providerApiKeys: fallbackKey ? { zai: fallbackKey } : undefined,
    providerConfigs: {
      zai: {
        baseUrl: env.ANTHROPIC_BASE_URL?.trim() || DEFAULT_ZAI_CONFIG.baseUrl,
        models: {
          heavy:
            env.ANTHROPIC_DEFAULT_OPUS_MODEL?.trim() ||
            DEFAULT_ZAI_CONFIG.opusModel,
          standard:
            env.ANTHROPIC_DEFAULT_SONNET_MODEL?.trim() ||
            DEFAULT_ZAI_CONFIG.sonnetModel,
          fast:
            env.ANTHROPIC_DEFAULT_HAIKU_MODEL?.trim() ||
            DEFAULT_ZAI_CONFIG.haikuModel,
        },
      },
    },
  }
  logger.app.info("zai_config_loaded", {
    hasKey: true,
    baseUrl: config.baseUrl,
    opusModel: config.opusModel,
    sonnetModel: config.sonnetModel,
    haikuModel: config.haikuModel,
  })
  return config
}

function writeClaudeSettingsForConfig(config: Partial<ZaiConfig>): void {
  const existing = readClaudeSettingsSync()
  const env = ((existing.env as Record<string, string | undefined>) || {})
  const zaiKey = config.providerApiKeys?.zai?.trim() || config.apiKey?.trim()
  const updatedEnv: Record<string, string | undefined> = {
    ...env,
    API_TIMEOUT_MS: "3000000",
  }

  if (zaiKey) {
    updatedEnv.ANTHROPIC_AUTH_TOKEN = zaiKey
    updatedEnv.ANTHROPIC_BASE_URL =
      config.baseUrl?.trim() || DEFAULT_ZAI_CONFIG.baseUrl
    updatedEnv.ANTHROPIC_DEFAULT_OPUS_MODEL =
      config.opusModel?.trim() || DEFAULT_ZAI_CONFIG.opusModel
    updatedEnv.ANTHROPIC_DEFAULT_SONNET_MODEL =
      config.sonnetModel?.trim() || DEFAULT_ZAI_CONFIG.sonnetModel
    updatedEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL =
      config.haikuModel?.trim() || DEFAULT_ZAI_CONFIG.haikuModel
  } else {
    delete updatedEnv.ANTHROPIC_AUTH_TOKEN
    delete updatedEnv.ANTHROPIC_BASE_URL
    delete updatedEnv.ANTHROPIC_DEFAULT_OPUS_MODEL
    delete updatedEnv.ANTHROPIC_DEFAULT_SONNET_MODEL
    delete updatedEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL
  }

  const updated = {
    ...existing,
    env: updatedEnv,
  }

  writeClaudeSettingsSync(updated)
  logger.app.info("zai_config_written", {
    target: CLAUDE_SETTINGS_PATH,
    hasKey: Boolean(zaiKey),
    baseUrl: updatedEnv.ANTHROPIC_BASE_URL,
  })
}

export function getActiveProvider(): ProviderPreset {
  const config = readZaiConfig()
  const presetId = config?.activeProvider ?? DEFAULT_PRESET_ID
  return getProviderConfig(presetId)
}

export function getProviderApiKey(presetId: string): string | null {
  const config = readZaiConfig()
  const providerKey = config?.providerApiKeys?.[presetId]?.trim()
  if (providerKey) {
    return providerKey
  }

  if (presetId === "zai") {
    return config?.apiKey?.trim() || null
  }

  return null
}

export function getProviderConfig(presetId: string): ProviderPreset {
  const config = readZaiConfig()
  const preset = PROVIDER_PRESETS[presetId] ?? PROVIDER_PRESETS.zai
  const override = config?.providerConfigs?.[presetId]
  return mergeProviderPreset(preset, override)
}

export function saveProviderApiKey(presetId: string, apiKey: string): void {
  const existing = readZaiConfig() ?? {}
  const normalizedKey = apiKey.trim()
  const providerApiKeys = {
    ...(existing.providerApiKeys ?? {}),
    [presetId]: normalizedKey,
  }

  const nextConfig: Partial<ZaiConfig> = {
    ...existing,
    providerApiKeys,
  }

  if (presetId === "zai") {
    nextConfig.apiKey = normalizedKey
  }

  writeZaiConfig(nextConfig)

  if (presetId === "zai") {
    writeClaudeSettingsForConfig(nextConfig)
  }
}

export function saveProviderConfig(
  presetId: string,
  config: ProviderConfig,
): ProviderPreset {
  const existing = readZaiConfig() ?? {}
  const nextConfig: Partial<ZaiConfig> = {
    ...existing,
    providerConfigs: {
      ...(existing.providerConfigs ?? {}),
      [presetId]: {
        baseUrl: config.baseUrl?.trim(),
        headers: config.headers,
        models: {
          heavy: config.models?.heavy?.trim(),
          standard: config.models?.standard?.trim(),
          fast: config.models?.fast?.trim(),
        },
      },
    },
  }

  if (presetId === "zai") {
    const mergedZaiProvider = mergeProviderPreset(PROVIDER_PRESETS.zai, nextConfig.providerConfigs?.zai)
    nextConfig.baseUrl = mergedZaiProvider.baseUrl
    nextConfig.opusModel = mergedZaiProvider.models.heavy
    nextConfig.sonnetModel = mergedZaiProvider.models.standard
    nextConfig.haikuModel = mergedZaiProvider.models.fast
  }

  writeZaiConfig(nextConfig)

  if (presetId === "zai") {
    writeClaudeSettingsForConfig(nextConfig)
  }

  return getProviderConfig(presetId)
}

export function setActiveProvider(presetId: string): void {
  const existing = readZaiConfig() ?? {}
  const nextConfig: Partial<ZaiConfig> = {
    ...existing,
    activeProvider: presetId,
  }

  writeZaiConfig(nextConfig)

  if (presetId === "zai") {
    writeClaudeSettingsForConfig(nextConfig)
  }
}

export async function getZaiConfig(): Promise<ZaiConfig | null> {
  const storedConfig = await readJsonFile<Partial<ZaiConfig>>(ZAI_CONFIG_PATH())
  const normalizedStored = normalizeConfig(storedConfig)
  if (normalizedStored) {
    const zaiProvider = mergeProviderPreset(
      PROVIDER_PRESETS.zai,
      storedConfig?.providerConfigs?.zai,
    )
    return {
      ...normalizedStored,
      baseUrl: zaiProvider.baseUrl,
      opusModel: zaiProvider.models.heavy,
      sonnetModel: zaiProvider.models.standard,
      haikuModel: zaiProvider.models.fast,
      activeProvider: storedConfig?.activeProvider,
      providerApiKeys: storedConfig?.providerApiKeys,
      providerConfigs: storedConfig?.providerConfigs,
    }
  }

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

  const existingStoredConfig = readStoredZaiConfigSync() ?? {}
  const nextConfig: Partial<ZaiConfig> = {
    ...existingStoredConfig,
    ...normalized,
    activeProvider: existingStoredConfig.activeProvider ?? DEFAULT_PRESET_ID,
    providerApiKeys: {
      ...(existingStoredConfig.providerApiKeys ?? {}),
      zai: normalized.apiKey,
    },
    providerConfigs: {
      ...(existingStoredConfig.providerConfigs ?? {}),
      zai: {
        ...(existingStoredConfig.providerConfigs?.zai ?? {}),
        baseUrl: normalized.baseUrl,
        models: {
          heavy: normalized.opusModel,
          standard: normalized.sonnetModel,
          fast: normalized.haikuModel,
        },
      },
    },
  }

  await fs.mkdir(path.dirname(ZAI_CONFIG_PATH()), { recursive: true })
  await fs.writeFile(ZAI_CONFIG_PATH(), JSON.stringify(nextConfig, null, 2), "utf-8")

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
