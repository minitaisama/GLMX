import { createACPProvider, type ACPProvider } from "@mcpc-tech/acp-ai-provider"
import { observable } from "@trpc/server/observable"
import { streamText } from "ai"
import { eq } from "drizzle-orm"
import { app } from "electron"
import { spawn, type ChildProcess } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import { createServer, request as httpRequest, type Server } from "node:http"
import { readdir, readFile } from "node:fs/promises"
import { request as httpsRequest } from "node:https"
import { homedir } from "node:os"
import { basename, dirname, join, sep } from "node:path"
import { z } from "zod"
import {
  normalizeCodexAssistantMessage,
  normalizeCodexStreamChunk,
} from "../../../../shared/codex-tool-normalizer"
import { type ProviderPreset } from "../../../../shared/provider-presets"
import { getClaudeShellEnvironment } from "../../claude/env"
import { resolveProjectPathFromWorktree } from "../../claude-config"
import { getDatabase, projects as projectsTable, subChats } from "../../db"
import {
  fetchMcpTools,
  fetchMcpToolsStdio,
  type McpToolInfo,
} from "../../mcp-auth"
import {
  getActiveProvider,
  getProviderApiKey,
  saveProviderApiKey,
} from "../../zai-config"
import { logger } from "../../logger"
import { beginLoggedModelCall } from "../../model-logger"
import { publicProcedure, router } from "../index"
import { resolveWorkspaceForChat } from "./chat-workspace"

const imageAttachmentSchema = z.object({
  base64Data: z.string(),
  mediaType: z.string(),
  filename: z.string().optional(),
})

type CodexProviderSession = {
  provider: ACPProvider
  cwd: string
  authFingerprint: string | null
  mcpFingerprint: string
  providerFingerprint: string
  requestedModelId: string
}

type CodexLoginSessionState =
  | "running"
  | "success"
  | "error"
  | "cancelled"

type CodexLoginSession = {
  id: string
  process: ChildProcess | null
  state: CodexLoginSessionState
  output: string
  url: string | null
  error: string | null
  exitCode: number | null
}

type CodexIntegrationState =
  | "connected_chatgpt"
  | "connected_api_key"
  | "not_logged_in"
  | "unknown"

type CodexMcpServerForSession =
  | {
      name: string
      type: "stdio"
      command: string
      args: string[]
      env: Array<{ name: string; value: string }>
    }
  | {
      name: string
      type: "http"
      url: string
      headers: Array<{ name: string; value: string }>
    }

type CodexMcpServerForSettings = {
  name: string
  status: "connected" | "failed" | "pending" | "needs-auth"
  tools: McpToolInfo[]
  needsAuth: boolean
  config: Record<string, unknown>
}

type CodexMcpSnapshot = {
  mcpServersForSession: CodexMcpServerForSession[]
  groups: Array<{
    groupName: string
    projectPath: string | null
    mcpServers: CodexMcpServerForSettings[]
  }>
  fingerprint: string
  fetchedAt: number
  toolsResolved: boolean
}

const providerSessions = new Map<string, CodexProviderSession>()
const providerProxyServers = new Map<string, { baseUrl: string; server: Server }>()
type ActiveCodexStream = {
  runId: string
  controller: AbortController
  cancelRequested: boolean
}

const activeStreams = new Map<string, ActiveCodexStream>()

function getResponsePreview(message: unknown): string {
  const parts = (message as { parts?: Array<{ type?: string; text?: string }> })?.parts
  if (!Array.isArray(parts)) return ""
  return parts
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
}

function hasAssistantTextPart(parts: unknown): boolean {
  if (!Array.isArray(parts)) return false
  return parts.some(
    (part: any) => part?.type === "text" && typeof part?.text === "string" && part.text.trim().length > 0,
  )
}

function buildCodexFallbackSummary(parts: unknown): string {
  if (!Array.isArray(parts)) {
    return "Done. Task completed."
  }

  const toolParts = parts.filter(
    (part: any) => typeof part?.type === "string" && part.type.startsWith("tool-"),
  )
  const uniqueToolNames = new Set(
    toolParts
      .map((part: any) => String(part.type || "").replace(/^tool-/, ""))
      .filter(Boolean),
  )

  const touchedFiles = Array.from(
    new Set(
      toolParts
        .filter((part: any) => part?.type === "tool-Write" || part?.type === "tool-Edit")
        .map((part: any) => part?.input?.file_path)
        .filter((pathValue: unknown): pathValue is string => typeof pathValue === "string" && pathValue.length > 0),
    ),
  )

  const summaryLines: string[] = ["Done. Task completed."]
  if (toolParts.length > 0) {
    summaryLines.push(`Executed ${toolParts.length} tool step${toolParts.length === 1 ? "" : "s"}.`)
  }
  if (uniqueToolNames.size > 0) {
    summaryLines.push(`Tools used: ${Array.from(uniqueToolNames).slice(0, 6).join(", ")}.`)
  }
  if (touchedFiles.length > 0) {
    const preview = touchedFiles.slice(0, 3).join(", ")
    const moreCount = touchedFiles.length - 3
    summaryLines.push(
      `Updated file${touchedFiles.length === 1 ? "" : "s"}: ${preview}${moreCount > 0 ? ` (+${moreCount} more)` : ""}.`,
    )
  }

  return summaryLines.join(" ")
}

/** Check if there are any active Codex streaming sessions */
export function hasActiveCodexStreams(): boolean {
  return activeStreams.size > 0
}

/** Abort all active Codex streams so their cleanup saves partial state */
export function abortAllCodexStreams(): void {
  for (const [subChatId, stream] of activeStreams) {
    console.log(`[codex] Aborting stream ${subChatId} before reload`)
    stream.controller.abort()
  }
  activeStreams.clear()
}
const loginSessions = new Map<string, CodexLoginSession>()
const codexMcpCache = new Map<string, CodexMcpSnapshot>()

const URL_CANDIDATE_REGEX = /https?:\/\/[^\s]+/g
const ANSI_ESCAPE_REGEX = /\u001B\[[0-?]*[ -/]*[@-~]/g
const ANSI_OSC_REGEX = /\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g

const AUTH_HINTS = [
  "not logged in",
  "authentication required",
  "auth required",
  "login required",
  "missing credentials",
  "no credentials",
  "unauthorized",
  "forbidden",
  "codex login",
  "401",
  "403",
]
const DEFAULT_CODEX_MODEL = "standard/high"
const CODEX_MCP_TOOLS_FETCH_TIMEOUT_MS = 40_000
const CODEX_USAGE_POLL_ATTEMPTS = 3
const CODEX_USAGE_POLL_INTERVAL_MS = 200
const CODEX_STREAM_IDLE_TIMEOUT_MS = 120_000

type CodexTokenUsage = {
  input_tokens?: number
  cached_input_tokens?: number
  output_tokens?: number
  total_tokens?: number
}

type CodexTokenCountInfo = {
  last_token_usage?: CodexTokenUsage
  model_context_window?: number
}

type CodexUsageMetadata = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  modelContextWindow?: number
}

const codexMcpListEntrySchema = z
  .object({
    name: z.string(),
    enabled: z.boolean(),
    disabled_reason: z.string().nullable().optional(),
    transport: z
      .object({
        type: z.string(),
        command: z.string().nullable().optional(),
        args: z.array(z.string()).nullable().optional(),
        env: z.record(z.string()).nullable().optional(),
        env_vars: z.array(z.string()).nullable().optional(),
        cwd: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        bearer_token_env_var: z.string().nullable().optional(),
        http_headers: z.record(z.string()).nullable().optional(),
        env_http_headers: z.record(z.string()).nullable().optional(),
      })
      .passthrough(),
    auth_status: z.string().nullable().optional(),
  })
  .passthrough()

type CodexMcpListEntry = z.infer<typeof codexMcpListEntrySchema>

function getCodexPackageName(): string {
  const platform = process.platform
  const arch = process.arch

  if (platform === "darwin") {
    if (arch === "arm64") return "@zed-industries/codex-acp-darwin-arm64"
    if (arch === "x64") return "@zed-industries/codex-acp-darwin-x64"
  }

  if (platform === "linux") {
    if (arch === "arm64") return "@zed-industries/codex-acp-linux-arm64"
    if (arch === "x64") return "@zed-industries/codex-acp-linux-x64"
  }

  if (platform === "win32") {
    if (arch === "arm64") return "@zed-industries/codex-acp-win32-arm64"
    if (arch === "x64") return "@zed-industries/codex-acp-win32-x64"
  }

  throw new Error(`Unsupported platform/arch for codex-acp: ${platform}/${arch}`)
}

function toUnpackedAsarPath(filePath: string): string {
  const unpackedPath = filePath.replace(
    `${sep}app.asar${sep}`,
    `${sep}app.asar.unpacked${sep}`,
  )

  if (unpackedPath !== filePath && existsSync(unpackedPath)) {
    return unpackedPath
  }

  return filePath
}

function resolveCodexAcpBinaryPath(): string {
  const packageName = getCodexPackageName()
  const binaryName = process.platform === "win32" ? "codex-acp.exe" : "codex-acp"
  const codexPackageRoot = dirname(
    require.resolve("@zed-industries/codex-acp/package.json"),
  )
  const resolvedPath = require.resolve(`${packageName}/bin/${binaryName}`, {
    // Resolve relative to the wrapper package so nested optional deps work in packaged apps.
    paths: [codexPackageRoot],
  })

  return toUnpackedAsarPath(resolvedPath)
}

function resolveBundledCodexCliPath(): string {
  const binaryName = process.platform === "win32" ? "codex.exe" : "codex"
  const resourcesDir = app.isPackaged
    ? join(process.resourcesPath, "bin")
    : join(
        app.getAppPath(),
        "resources",
        "bin",
        `${process.platform}-${process.arch}`,
      )

  const binaryPath = join(resourcesDir, binaryName)
  if (existsSync(binaryPath)) {
    return binaryPath
  }

  const hint = app.isPackaged
    ? "Binary is missing from bundled resources."
    : "Run `bun run codex:download` to download it for local dev."

  throw new Error(
    `[codex] Bundled Codex CLI not found at ${binaryPath}. ${hint}`,
  )
}

function stripAnsi(input: string): string {
  return input.replace(ANSI_OSC_REGEX, "").replace(ANSI_ESCAPE_REGEX, "")
}

function isLocalhostHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.endsWith(".localhost")
  )
}

function extractFirstNonLocalhostUrl(output: string): string | null {
  const matches = stripAnsi(output).match(URL_CANDIDATE_REGEX)
  if (!matches) return null

  for (const match of matches) {
    try {
      const parsedUrl = new URL(match.trim().replace(/[),.;!?]+$/, ""))
      if (!isLocalhostHostname(parsedUrl.hostname)) {
        return parsedUrl.toString()
      }
    } catch {
      // Ignore invalid URL candidates.
    }
  }

  return null
}

function appendLoginOutput(session: CodexLoginSession, chunk: string): void {
  const cleanChunk = stripAnsi(chunk)
  if (!cleanChunk) return

  session.output += cleanChunk

  if (!session.url) {
    session.url = extractFirstNonLocalhostUrl(session.output)
  }
}

function toLoginSessionResponse(session: CodexLoginSession) {
  return {
    sessionId: session.id,
    state: session.state,
    url: session.url,
    output: session.output,
    error: session.error,
    exitCode: session.exitCode,
  }
}

function getActiveLoginSession(): CodexLoginSession | null {
  for (const session of loginSessions.values()) {
    if (session.state === "running" && session.process && !session.process.killed) {
      return session
    }
  }

  return null
}

function extractCodexError(error: unknown): { message: string; code?: string } {
  const anyError = error as any
  const message =
    anyError?.data?.message ||
    anyError?.errorText ||
    anyError?.message ||
    anyError?.error ||
    String(error)
  const code = anyError?.data?.code || anyError?.code

  return {
    message: typeof message === "string" ? message : String(message),
    code: typeof code === "string" ? code : undefined,
  }
}

function isCodexAuthError(params: {
  message?: string | null
  code?: string | null
}): boolean {
  const searchableText = `${params.code || ""} ${params.message || ""}`.toLowerCase()
  return AUTH_HINTS.some((hint) => searchableText.includes(hint))
}

type RunCodexCliOptions = {
  cwd?: string
}

async function runCodexCli(
  args: string[],
  options?: RunCodexCliOptions,
): Promise<{
  stdout: string
  stderr: string
  exitCode: number | null
}> {
  const codexCliPath = resolveBundledCodexCliPath()
  const cwd = options?.cwd?.trim()

  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(codexCliPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: cwd && cwd.length > 0 ? cwd : undefined,
      env: process.env,
      windowsHide: true,
    })

    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8")
    })

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8")
    })

    child.once("error", (error) => {
      rejectPromise(
        new Error(
          `[codex] Failed to execute \`codex ${args.join(" ")}\`: ${error.message}`,
        ),
      )
    })

    child.once("close", (exitCode) => {
      resolvePromise({
        stdout: stripAnsi(stdout),
        stderr: stripAnsi(stderr),
        exitCode,
      })
    })
  })
}

async function runCodexCliChecked(
  args: string[],
  options?: RunCodexCliOptions,
): Promise<{
  stdout: string
  stderr: string
}> {
  const result = await runCodexCli(args, options)
  if (result.exitCode === 0) {
    return {
      stdout: result.stdout,
      stderr: result.stderr,
    }
  }

  const message =
    result.stderr.trim() ||
    result.stdout.trim() ||
    `Codex command failed with exit code ${result.exitCode ?? "unknown"}`
  throw new Error(message)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

function toNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined
  }
  return Math.trunc(value)
}

function toTimestampMs(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined
  }
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    return undefined
  }
  return parsed
}

function resolveSessionsRoot(): string {
  // Match provider env precedence: shell-derived env overrides process.env.
  const shellCodexHome = getClaudeShellEnvironment().CODEX_HOME?.trim()
  if (shellCodexHome) {
    return join(shellCodexHome, "sessions")
  }

  const processCodexHome = process.env.CODEX_HOME?.trim()
  if (processCodexHome) {
    return join(processCodexHome, "sessions")
  }

  return join(homedir(), ".codex", "sessions")
}

async function findSessionFileById(sessionId: string): Promise<string | null> {
  const sessionsRoot = resolveSessionsRoot()
  const fileSuffix = `-${sessionId}.jsonl`
  const sortDesc = (values: string[]) =>
    values.sort((left, right) =>
      right.localeCompare(left, undefined, { numeric: true }),
    )
  const listNames = async (dirPath: string): Promise<string[]> => {
    try {
      return await readdir(dirPath, { encoding: "utf8" })
    } catch {
      return []
    }
  }
  const years = sortDesc(
    (await listNames(sessionsRoot)).filter((name) => /^\d{4}$/.test(name)),
  )

  for (const year of years) {
    const yearPath = join(sessionsRoot, year)
    const months = sortDesc(
      (await listNames(yearPath)).filter((name) => /^\d{2}$/.test(name)),
    )
    for (const month of months) {
      const monthPath = join(yearPath, month)
      const days = sortDesc(
        (await listNames(monthPath)).filter((name) => /^\d{2}$/.test(name)),
      )
      for (const day of days) {
        const dayPath = join(monthPath, day)
        const fileName = (await listNames(dayPath)).find((name) =>
          name.endsWith(fileSuffix),
        )
        if (fileName) {
          return join(dayPath, fileName)
        }
      }
    }
  }

  return null
}

async function readLatestTokenCountInfo(
  filePath: string,
  options?: { notBeforeTimestampMs?: number },
): Promise<CodexTokenCountInfo | null> {
  let rawContent = ""
  try {
    rawContent = await readFile(filePath, "utf8")
  } catch {
    return null
  }

  const lines = rawContent.split("\n")
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const rawLine = lines[index]?.trim()
    if (!rawLine) continue

    let parsedLine: any
    try {
      parsedLine = JSON.parse(rawLine)
    } catch {
      continue
    }

    if (
      parsedLine?.type !== "event_msg" ||
      parsedLine?.payload?.type !== "token_count"
    ) {
      continue
    }

    const eventTimestampMs = toTimestampMs(parsedLine?.timestamp)
    const notBeforeTimestampMs = options?.notBeforeTimestampMs
    if (
      notBeforeTimestampMs !== undefined &&
      (eventTimestampMs === undefined || eventTimestampMs < notBeforeTimestampMs)
    ) {
      continue
    }

    const rawInfo = parsedLine.payload?.info
    if (!rawInfo || typeof rawInfo !== "object") continue

    const rawTokenUsage = (rawInfo as any).last_token_usage
    let lastTokenUsage: CodexTokenUsage | undefined
    if (rawTokenUsage && typeof rawTokenUsage === "object") {
      const tokenUsage = rawTokenUsage as any
      const parsedTokenUsage: CodexTokenUsage = {
        input_tokens: toNonNegativeInt(tokenUsage.input_tokens),
        cached_input_tokens: toNonNegativeInt(tokenUsage.cached_input_tokens),
        output_tokens: toNonNegativeInt(tokenUsage.output_tokens),
        total_tokens: toNonNegativeInt(tokenUsage.total_tokens),
      }
      if (Object.values(parsedTokenUsage).some((tokenCount) => tokenCount !== undefined)) {
        lastTokenUsage = parsedTokenUsage
      }
    }

    const modelContextWindow = toNonNegativeInt(
      (rawInfo as any).model_context_window,
    )

    const info: CodexTokenCountInfo = {
      last_token_usage: lastTokenUsage,
      model_context_window: modelContextWindow,
    }
    if (!info.last_token_usage && info.model_context_window === undefined) continue

    return info
  }

  return null
}

function mapToUsageMetadata(info: CodexTokenCountInfo): CodexUsageMetadata | null {
  const perMessageUsage = info.last_token_usage

  if (!perMessageUsage && info.model_context_window === undefined) {
    return null
  }

  const inputTokens =
    perMessageUsage?.input_tokens !== undefined
      ? Math.max(
          0,
          perMessageUsage.input_tokens - (perMessageUsage.cached_input_tokens ?? 0),
        )
      : undefined
  const outputTokens = perMessageUsage?.output_tokens
  const totalTokens =
    perMessageUsage?.total_tokens ??
    (perMessageUsage?.input_tokens !== undefined || perMessageUsage?.output_tokens !== undefined
      ? (perMessageUsage?.input_tokens ?? 0) + (perMessageUsage?.output_tokens ?? 0)
      : undefined
    )

  const usageMetadata: CodexUsageMetadata = {}
  if (inputTokens !== undefined) usageMetadata.inputTokens = inputTokens
  if (outputTokens !== undefined) usageMetadata.outputTokens = outputTokens
  if (totalTokens !== undefined) usageMetadata.totalTokens = totalTokens
  if (info.model_context_window !== undefined) {
    usageMetadata.modelContextWindow = info.model_context_window
  }

  return Object.keys(usageMetadata).length > 0 ? usageMetadata : null
}

async function pollUsage(
  sessionId: string,
  options?: { notBeforeTimestampMs?: number },
): Promise<CodexUsageMetadata | null> {
  let sessionFilePath: string | null = null

  for (let attempt = 0; attempt < CODEX_USAGE_POLL_ATTEMPTS; attempt += 1) {
    if (!sessionFilePath) {
      sessionFilePath = await findSessionFileById(sessionId)
    }

    if (sessionFilePath) {
      const latestInfo = await readLatestTokenCountInfo(sessionFilePath, options)
      if (latestInfo) {
        const usageMetadata = mapToUsageMetadata(latestInfo)
        if (usageMetadata) {
          return usageMetadata
        }
      }
    }

    if (attempt < CODEX_USAGE_POLL_ATTEMPTS - 1) {
      await sleep(CODEX_USAGE_POLL_INTERVAL_MS)
    }
  }

  return null
}

function getCodexMcpAuthState(authStatus: string | null | undefined): {
  supportsAuth: boolean
  authenticated: boolean
  needsAuth: boolean
} {
  const normalized = (authStatus || "").trim().toLowerCase()

  // Exact CLI values from codex-rs/protocol/src/protocol.rs (McpAuthStatus):
  // unsupported | not_logged_in | bearer_token | o_auth
  switch (normalized) {
    case "":
    case "none":
    case "unsupported":
      return { supportsAuth: false, authenticated: false, needsAuth: false }
    case "not_logged_in":
      return { supportsAuth: true, authenticated: false, needsAuth: true }
    case "bearer_token":
    case "o_auth":
      return { supportsAuth: true, authenticated: true, needsAuth: false }
    default:
      // Unknown/forward-compatible value: don't force needs-auth.
      return { supportsAuth: true, authenticated: false, needsAuth: false }
  }
}

function objectToPairs(
  value: Record<string, string> | null | undefined,
): Array<{ name: string; value: string }> | undefined {
  if (!value) return undefined
  const pairs = Object.entries(value)
    .filter(([name, val]) => typeof name === "string" && typeof val === "string")
    .map(([name, val]) => ({ name, value: val }))

  return pairs.length > 0 ? pairs : undefined
}

function resolveCodexStdioEnv(
  transport: CodexMcpListEntry["transport"],
): Record<string, string> | undefined {
  const merged: Record<string, string> = {}

  if (transport.env) {
    for (const [name, value] of Object.entries(transport.env)) {
      if (typeof name === "string" && typeof value === "string") {
        merged[name] = value
      }
    }
  }

  if (Array.isArray(transport.env_vars)) {
    for (const envName of transport.env_vars) {
      const value = process.env[envName]
      if (typeof value === "string" && value.length > 0 && !merged[envName]) {
        merged[envName] = value
      }
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined
}

function resolveCodexHttpHeaders(
  transport: CodexMcpListEntry["transport"],
): Record<string, string> | undefined {
  const merged: Record<string, string> = {}

  if (transport.http_headers) {
    for (const [name, value] of Object.entries(transport.http_headers)) {
      if (typeof name === "string" && typeof value === "string") {
        merged[name] = value
      }
    }
  }

  if (transport.env_http_headers) {
    for (const [headerName, envName] of Object.entries(transport.env_http_headers)) {
      if (typeof headerName !== "string" || typeof envName !== "string") continue
      const value = process.env[envName]
      if (typeof value === "string" && value.length > 0) {
        merged[headerName] = value
      }
    }
  }

  const bearerEnvVar = transport.bearer_token_env_var?.trim()
  if (bearerEnvVar && !merged.Authorization) {
    const token = process.env[bearerEnvVar]?.trim()
    if (token) {
      merged.Authorization = `Bearer ${token}`
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined
}

function normalizeCodexTools(tools: McpToolInfo[]): McpToolInfo[] {
  const unique = new Map<string, McpToolInfo>()
  for (const tool of tools) {
    if (typeof tool?.name === "string" && tool.name.trim()) {
      const name = tool.name.trim()
      unique.set(name, {
        name,
        ...(tool.description ? { description: tool.description } : {}),
      })
    }
  }
  return [...unique.values()]
}

async function fetchCodexMcpTools(entry: CodexMcpListEntry): Promise<McpToolInfo[]> {
  const transportType = entry.transport.type.trim().toLowerCase()
  const timeoutPromise = new Promise<McpToolInfo[]>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), CODEX_MCP_TOOLS_FETCH_TIMEOUT_MS),
  )

  const fetchPromise = (async (): Promise<McpToolInfo[]> => {
    if (transportType === "stdio") {
      const command = entry.transport.command?.trim()
      if (!command) return []
      return await fetchMcpToolsStdio({
        command,
        args: entry.transport.args || undefined,
        env: resolveCodexStdioEnv(entry.transport),
      })
    }

    if (
      transportType === "streamable_http" ||
      transportType === "http" ||
      transportType === "sse"
    ) {
      const url = entry.transport.url?.trim()
      if (!url) return []
      return await fetchMcpTools(url, resolveCodexHttpHeaders(entry.transport))
    }

    return []
  })()

  try {
    const tools = await Promise.race([fetchPromise, timeoutPromise])
    return normalizeCodexTools(tools)
  } catch {
    return []
  }
}

function resolveCodexLookupPath(pathCandidate: string | null | undefined): string {
  return pathCandidate && pathCandidate.trim() ? pathCandidate.trim() : "__global__"
}

function getCodexMcpFingerprint(servers: CodexMcpServerForSession[]): string {
  return createHash("sha256").update(JSON.stringify(servers)).digest("hex")
}

async function resolveCodexMcpSnapshot(params: {
  lookupPath?: string | null
  forceRefresh?: boolean
  includeTools?: boolean
}): Promise<CodexMcpSnapshot> {
  const lookupPath = resolveCodexLookupPath(params.lookupPath)
  const cached = codexMcpCache.get(lookupPath)
  const shouldIncludeTools = Boolean(params.includeTools)
  if (
    cached &&
    !params.forceRefresh &&
    (!shouldIncludeTools || cached.toolsResolved)
  ) {
    return cached
  }

  const result = await runCodexCliChecked(["mcp", "list", "--json"], {
    cwd: lookupPath === "__global__" ? undefined : lookupPath,
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(result.stdout)
  } catch {
    throw new Error("Failed to parse Codex MCP list JSON output.")
  }

  const entries = z.array(codexMcpListEntrySchema).parse(parsed)
  const mcpServersForSession: CodexMcpServerForSession[] = []
  const mcpServersForSettings: CodexMcpServerForSettings[] = []

  const convertedEntries = await Promise.all(
    entries.map(async (entry) => {
      const transportType = entry.transport.type.trim().toLowerCase()
      const authState = getCodexMcpAuthState(entry.auth_status)
      const includeInSession = entry.enabled
      const resolvedStdioEnv = resolveCodexStdioEnv(entry.transport)
      const resolvedHttpHeaders = resolveCodexHttpHeaders(entry.transport)
      let status: CodexMcpServerForSettings["status"] = !entry.enabled
        ? "failed"
        : authState.needsAuth
          ? "needs-auth"
          : "connected"

      const settingsConfig: Record<string, unknown> = {
        transportType: entry.transport.type,
        authStatus: entry.auth_status ?? "unknown",
        enabled: entry.enabled,
        disabledReason: entry.disabled_reason ?? undefined,
      }

      let sessionServer: CodexMcpServerForSession | null = null
      if (transportType === "stdio") {
        const command = entry.transport.command || undefined
        const args = entry.transport.args || undefined
        if (includeInSession && command) {
          const envPairs = objectToPairs(resolvedStdioEnv) || []
          sessionServer = {
            name: entry.name,
            type: "stdio",
            command,
            args: Array.isArray(args) ? args : [],
            env: envPairs,
          }
        }

        settingsConfig.command = command
        settingsConfig.args = args
        settingsConfig.env = entry.transport.env || undefined
        settingsConfig.envVars = entry.transport.env_vars || undefined
      } else if (
        transportType === "streamable_http" ||
        transportType === "http" ||
        transportType === "sse"
      ) {
        const url = entry.transport.url || undefined
        const headers = objectToPairs(resolvedHttpHeaders)
        if (includeInSession && url) {
          sessionServer = {
            name: entry.name,
            type: "http",
            url,
            headers: headers || [],
          }
        }

        settingsConfig.url = url
        settingsConfig.headers = entry.transport.http_headers || undefined
        settingsConfig.envHttpHeaders = entry.transport.env_http_headers || undefined
        settingsConfig.bearerTokenEnvVar =
          entry.transport.bearer_token_env_var || undefined
      }

      const shouldProbeTools =
        shouldIncludeTools &&
        includeInSession &&
        !authState.needsAuth &&
        (
          // Probe unauthenticated/public servers and stdio servers.
          !authState.supportsAuth ||
          transportType === "stdio" ||
          // For auth-capable HTTP, only probe if explicit auth header is available.
          Boolean(resolvedHttpHeaders?.Authorization)
        )
      const tools = shouldProbeTools ? await fetchCodexMcpTools(entry) : []
      if (shouldProbeTools && tools.length === 0) {
        status = "failed"
      }

      return {
        sessionServer,
        settingsServer: {
          name: entry.name,
          status,
          tools,
          needsAuth: authState.needsAuth,
          config: settingsConfig,
        } satisfies CodexMcpServerForSettings,
      }
    }),
  )

  for (const converted of convertedEntries) {
    if (converted.sessionServer) {
      mcpServersForSession.push(converted.sessionServer)
    }
    mcpServersForSettings.push(converted.settingsServer)
  }

  const snapshot: CodexMcpSnapshot = {
    mcpServersForSession,
    groups: [
      {
        groupName: "Global",
        projectPath: null,
        mcpServers: mcpServersForSettings,
      },
    ],
    fingerprint: getCodexMcpFingerprint(mcpServersForSession),
    fetchedAt: Date.now(),
    toolsResolved: shouldIncludeTools,
  }

  codexMcpCache.set(lookupPath, snapshot)
  return snapshot
}

function clearCodexMcpCache(): void {
  codexMcpCache.clear()
}

function getCodexServerIdentity(
  server: CodexMcpServerForSettings,
): string {
  const config = server.config as Record<string, unknown>
  return JSON.stringify({
    enabled: config.enabled ?? null,
    disabledReason: config.disabledReason ?? null,
    transportType: config.transportType ?? null,
    command: config.command ?? null,
    args: config.args ?? null,
    env: config.env ?? null,
    envVars: config.envVars ?? null,
    url: config.url ?? null,
    headers: config.headers ?? null,
    envHttpHeaders: config.envHttpHeaders ?? null,
    bearerTokenEnvVar: config.bearerTokenEnvVar ?? null,
    authStatus: config.authStatus ?? null,
  })
}

export async function getAllCodexMcpConfigHandler() {
  const globalSnapshot = await resolveCodexMcpSnapshot({ includeTools: true })
  const globalServers = globalSnapshot.groups[0]?.mcpServers || []
  const globalByName = new Map(
    globalServers.map((server) => [server.name, getCodexServerIdentity(server)]),
  )

  const groups: CodexMcpSnapshot["groups"] = [...globalSnapshot.groups]

  // Only enumerate projects the app knows about (DB-backed projects).
  // Do not scan ~/.codex/config.toml project entries.
  const projectPathSet = new Set<string>()

  try {
    const db = getDatabase()
    const dbProjects = db.select({ path: projectsTable.path }).from(projectsTable).all()
    for (const project of dbProjects) {
      if (typeof project.path === "string" && project.path.trim().length > 0) {
        projectPathSet.add(project.path)
      }
    }
  } catch (error) {
    console.error("[codex.getAllMcpConfig] Failed to read projects from DB:", error)
  }

  const projectPaths = [...projectPathSet].sort((a, b) => a.localeCompare(b))
  const projectResults = await Promise.allSettled(
    projectPaths.map(async (projectPath) => {
      const projectSnapshot = await resolveCodexMcpSnapshot({
        lookupPath: projectPath,
        includeTools: true,
      })
      const effectiveServers = projectSnapshot.groups[0]?.mcpServers || []
      const projectOnlyServers = effectiveServers.filter((server) => {
        const globalIdentity = globalByName.get(server.name)
        if (!globalIdentity) return true
        return globalIdentity !== getCodexServerIdentity(server)
      })

      if (projectOnlyServers.length === 0) {
        return null
      }

      return {
        groupName: basename(projectPath) || projectPath,
        projectPath,
        mcpServers: projectOnlyServers,
      }
    }),
  )

  for (const result of projectResults) {
    if (result.status === "fulfilled" && result.value) {
      groups.push(result.value)
      continue
    }
    if (result.status === "rejected") {
      console.error("[codex.getAllMcpConfig] Failed to resolve project MCP snapshot:", result.reason)
    }
  }

  return { groups }
}

function normalizeCodexIntegrationState(rawOutput: string): CodexIntegrationState {
  const normalizedOutput = rawOutput.toLowerCase()

  if (normalizedOutput.includes("logged in using chatgpt")) {
    return "connected_chatgpt"
  }

  if (
    normalizedOutput.includes("logged in using an api key") ||
    normalizedOutput.includes("logged in using api key")
  ) {
    return "connected_api_key"
  }

  if (normalizedOutput.includes("not logged in")) {
    return "not_logged_in"
  }

  return "unknown"
}

function parseStoredMessages(raw: string | null | undefined): any[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function extractPromptFromStoredMessage(message: any): string {
  if (!message || !Array.isArray(message.parts)) return ""

  const textParts: string[] = []
  const fileContents: string[] = []

  for (const part of message.parts) {
    if (part?.type === "text" && typeof part.text === "string") {
      textParts.push(part.text)
    } else if (part?.type === "file-content") {
      const filePath =
        typeof part.filePath === "string" ? part.filePath : undefined
      const fileName = filePath?.split("/").pop() || filePath || "file"
      const content = typeof part.content === "string" ? part.content : ""
      fileContents.push(`\n--- ${fileName} ---\n${content}`)
    }
  }

  return textParts.join("\n") + fileContents.join("")
}

function getLastSessionId(messages: any[]): string | undefined {
  const lastAssistant = [...messages].reverse().find((message) => message?.role === "assistant")
  const sessionId = lastAssistant?.metadata?.sessionId
  return typeof sessionId === "string" ? sessionId : undefined
}

function extractCodexModelId(rawModel: unknown): string | undefined {
  if (typeof rawModel !== "string" || rawModel.length === 0) {
    return undefined
  }

  const normalizedModel = rawModel.trim()

  if (!normalizedModel || normalizedModel === "codex") {
    return undefined
  }

  return normalizedModel
}

function resolvePresetModel(modelId: string, preset: ProviderPreset): string {
  const normalizedModel = modelId.trim().toLowerCase()
  const [baseModel] = normalizedModel.split("/")

  if (baseModel === "heavy") {
    return preset.models.heavy
  }

  if (baseModel === "standard") {
    return preset.models.standard
  }

  if (baseModel === "fast") {
    return preset.models.fast
  }

  if (baseModel.includes("mini") || baseModel.includes("fast")) {
    return preset.models.fast
  }

  if (
    baseModel.includes("5.3") ||
    baseModel.includes("max") ||
    baseModel.includes("xhigh")
  ) {
    return preset.models.heavy
  }

  return preset.models.standard
}

function preprocessCodexModelName(params: {
  modelId: string
  preset: ProviderPreset
}): string {
  return resolvePresetModel(params.modelId, params.preset)
}

function resolveAcpModelId(modelId: string): string {
  const normalizedModel = modelId.trim().toLowerCase()
  const [baseModel, effortRaw] = normalizedModel.split("/")
  const effort =
    effortRaw === "low" ||
    effortRaw === "medium" ||
    effortRaw === "high" ||
    effortRaw === "xhigh"
      ? effortRaw
      : "medium"

  if (baseModel === "heavy") {
    return `gpt-5.2-codex/${effort === "low" ? "medium" : effort}`
  }

  if (baseModel === "fast") {
    return `gpt-5.1-codex-mini/${effort === "low" ? "medium" : effort === "xhigh" ? "high" : effort}`
  }

  if (baseModel.includes("mini") || baseModel.includes("fast")) {
    return `gpt-5.1-codex-mini/${effort === "low" ? "medium" : effort === "xhigh" ? "high" : effort}`
  }

  if (baseModel.includes("max") || baseModel.includes("5.3") || baseModel.includes("xhigh")) {
    return `gpt-5.1-codex-max/${effort}`
  }

  return `gpt-5.2/${effort}`
}

function getAuthFingerprint(apiKey: string | null): string | null {
  const normalizedKey = apiKey?.trim()
  if (!normalizedKey) return null
  return createHash("sha256").update(normalizedKey).digest("hex")
}

function getProviderFingerprint(preset: ProviderPreset): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: preset.id,
        baseUrl: preset.baseUrl,
        defaultHeaders: preset.defaultHeaders ?? {},
        models: preset.models,
      }),
    )
    .digest("hex")
}

async function ensureProviderBaseUrl(preset: ProviderPreset): Promise<string> {
  if (!preset.defaultHeaders || Object.keys(preset.defaultHeaders).length === 0) {
    return preset.baseUrl
  }

  const proxyKey = getProviderFingerprint(preset)
  const existing = providerProxyServers.get(proxyKey)
  if (existing) {
    return existing.baseUrl
  }

  const targetUrl = new URL(preset.baseUrl)
  const targetPathPrefix = targetUrl.pathname.replace(/\/$/, "")
  const server = createServer((incomingReq, incomingRes) => {
    const requestImpl = targetUrl.protocol === "https:" ? httpsRequest : httpRequest
    const requestUrl = new URL(incomingReq.url || "/", "http://127.0.0.1")
    const pathSegments = requestUrl.pathname.split("/").filter(Boolean)
    const hasModelHintPrefix = pathSegments[0] === "glmx" && pathSegments.length >= 2
    const modelHint = hasModelHintPrefix
      ? decodeURIComponent(pathSegments[1] || "")
      : undefined
    const rewrittenPathname = hasModelHintPrefix
      ? `/${pathSegments.slice(2).join("/")}`
      : requestUrl.pathname
    const incomingPath = `${rewrittenPathname || "/"}${requestUrl.search || ""}`
    const pathOnly = rewrittenPathname || "/"

    const forwardRequest = (bodyBuffer?: Buffer) => {
      const upstreamPath = targetPathPrefix
        ? `${targetPathPrefix}${incomingPath.startsWith("/") ? incomingPath : `/${incomingPath}`}`
        : incomingPath
      const forwardedHeaders = {
        ...incomingReq.headers,
        ...preset.defaultHeaders,
        host: targetUrl.host,
      }

      if (bodyBuffer) {
        forwardedHeaders["content-length"] = String(bodyBuffer.length)
      }

      const upstreamReq = requestImpl(
        {
          protocol: targetUrl.protocol,
          hostname: targetUrl.hostname,
          port: targetUrl.port || undefined,
          method: incomingReq.method,
          path: upstreamPath,
          headers: forwardedHeaders,
        },
        (upstreamRes) => {
          if (pathOnly === "/models") {
            const chunks: Buffer[] = []
            upstreamRes.on("data", (chunk) => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
            })
            upstreamRes.on("end", () => {
              try {
                const rawBody = Buffer.concat(chunks).toString("utf8")
                const parsed = JSON.parse(rawBody) as {
                  data?: Array<{ id?: string }>
                }
                const data = Array.isArray(parsed.data) ? parsed.data : []
                const transformed = {
                  models: data
                    .map((model) => ({
                      id: typeof model.id === "string" ? model.id : "",
                      name: typeof model.id === "string" ? model.id : "",
                      label: typeof model.id === "string" ? model.id : "",
                    }))
                    .filter((model) => model.id.length > 0),
                  currentModelId: null,
                }

                incomingRes.writeHead(upstreamRes.statusCode || 502, {
                  ...upstreamRes.headers,
                  "content-type": "application/json; charset=utf-8",
                })
                incomingRes.end(JSON.stringify(transformed))
              } catch {
                incomingRes.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
                incomingRes.end(Buffer.concat(chunks))
              }
            })
            return
          }

          incomingRes.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
          upstreamRes.pipe(incomingRes)
        },
      )

      upstreamReq.on("error", (error) => {
        incomingRes.writeHead(502, { "content-type": "text/plain; charset=utf-8" })
        incomingRes.end(`Proxy request failed: ${error.message}`)
      })

      if (bodyBuffer) {
        upstreamReq.end(bodyBuffer)
        return
      }

      incomingReq.pipe(upstreamReq)
    }

    if (
      modelHint &&
      (pathOnly === "/responses" || pathOnly === "/chat/completions") &&
      incomingReq.method &&
      ["POST", "PUT", "PATCH"].includes(incomingReq.method.toUpperCase())
    ) {
      const requestChunks: Buffer[] = []
      incomingReq.on("data", (chunk) => {
        requestChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      incomingReq.on("end", () => {
        const rawBody = Buffer.concat(requestChunks).toString("utf8")
        try {
          const parsed = JSON.parse(rawBody) as Record<string, unknown>
          parsed.model = preprocessCodexModelName({
            modelId: modelHint,
            preset,
          })
          forwardRequest(Buffer.from(JSON.stringify(parsed), "utf8"))
        } catch {
          forwardRequest(Buffer.concat(requestChunks))
        }
      })
      return
    }

    forwardRequest()
  })

  const port = await new Promise<number>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind 9router proxy"))
        return
      }
      resolve(address.port)
    })
  })

  const baseUrl = `http://127.0.0.1:${port}`
  providerProxyServers.set(proxyKey, { baseUrl, server })
  return baseUrl
}

async function resolveCodexProviderConfig(): Promise<{
  preset: ProviderPreset
  apiKey: string | null
  baseUrl: string
  isProxyBaseUrl: boolean
  authFingerprint: string | null
  providerFingerprint: string
}> {
  const preset = getActiveProvider()
  const apiKey = getProviderApiKey(preset.id)
  const isProxyBaseUrl = Boolean(
    preset.defaultHeaders && Object.keys(preset.defaultHeaders).length > 0,
  )
  const baseUrl = await ensureProviderBaseUrl(preset)

  return {
    preset,
    apiKey,
    baseUrl,
    isProxyBaseUrl,
    authFingerprint: getAuthFingerprint(apiKey),
    providerFingerprint: getProviderFingerprint(preset),
  }
}

function buildCodexProviderEnv(params: {
  apiKey: string | null
  baseUrl: string
  requestedModelId: string
  isProxyBaseUrl: boolean
  codexHome: string
}): Record<string, string> {
  const env: Record<string, string> = {}

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value
    }
  }

  const shellEnv = getClaudeShellEnvironment()
  for (const [key, value] of Object.entries(shellEnv)) {
    if (typeof value === "string") {
      env[key] = value
    }
  }

  const baseUrlWithHint = params.isProxyBaseUrl
    ? `${params.baseUrl.replace(/\/$/, "")}/glmx/${encodeURIComponent(params.requestedModelId)}`
    : params.baseUrl

  return {
    ...env,
    HOME: dirname(params.codexHome),
    CODEX_HOME: params.codexHome,
    OPENAI_API_KEY: params.apiKey ?? "",
    OPENAI_BASE_URL: baseUrlWithHint,
  }
}

function getCodexAuthMethodId(apiKey: string | null): "openai-api-key" | undefined {
  const normalizedKey = apiKey?.trim()
  if (!normalizedKey) {
    return undefined
  }

  return "openai-api-key"
}

function getLegacyAuthConfigApiKey(authConfig?: { apiKey: string }): string | null {
  const apiKey = authConfig?.apiKey?.trim()
  if (!apiKey) return null
  return apiKey
}

function buildUserParts(
  prompt: string,
  images:
    | Array<{
        base64Data?: string
        mediaType?: string
        filename?: string
      }>
    | undefined,
): any[] {
  const parts: any[] = [{ type: "text", text: prompt }]

  if (images && images.length > 0) {
    for (const image of images) {
      if (!image.base64Data || !image.mediaType) continue
      parts.push({
        type: "data-image",
        data: {
          base64Data: image.base64Data,
          mediaType: image.mediaType,
          filename: image.filename,
        },
      })
    }
  }

  return parts
}

function buildModelMessageContent(
  prompt: string,
  images:
    | Array<{
        base64Data?: string
        mediaType?: string
        filename?: string
      }>
    | undefined,
): any[] {
  const content: any[] = [{ type: "text", text: prompt }]

  if (images && images.length > 0) {
    for (const image of images) {
      if (!image.base64Data || !image.mediaType) continue
      content.push({
        type: "file",
        mediaType: image.mediaType,
        data: image.base64Data,
        ...(image.filename ? { filename: image.filename } : {}),
      })
    }
  }

  return content
}

async function getOrCreateProvider(params: {
  subChatId: string
  cwd: string
  mcpServers: CodexMcpServerForSession[]
  mcpFingerprint: string
  requestedModelId: string
  existingSessionId?: string
  authConfig?: {
    apiKey: string
  }
}): Promise<ACPProvider> {
  const providerConfig = await resolveCodexProviderConfig()
  const fallbackApiKey = getLegacyAuthConfigApiKey(params.authConfig)
  const apiKey = providerConfig.apiKey ?? fallbackApiKey
  const authFingerprint = getAuthFingerprint(apiKey)
  const existing = providerSessions.get(params.subChatId)

  if (
    existing &&
    existing.cwd === params.cwd &&
    existing.authFingerprint === authFingerprint &&
    existing.mcpFingerprint === params.mcpFingerprint &&
    existing.providerFingerprint === providerConfig.providerFingerprint &&
    existing.requestedModelId === params.requestedModelId
  ) {
    return existing.provider
  }

  if (existing) {
    existing.provider.cleanup()
    providerSessions.delete(params.subChatId)
  }

  const hasAppManagedApiKey = Boolean(apiKey)
  // When app-managed key auth is used, avoid resuming older persisted session IDs.
  // Those can be tied to unauthenticated/CLI-auth state and trigger auth loops.
  const existingSessionIdForProvider = hasAppManagedApiKey
    ? undefined
    : params.existingSessionId

  const codexHome = join(
    app.getPath("userData"),
    "codex-provider-state",
    inputSafePathSegment(params.subChatId),
  )
  mkdirSync(codexHome, { recursive: true })

  const provider = createACPProvider({
    command: resolveCodexAcpBinaryPath(),
    env: buildCodexProviderEnv({
      apiKey,
      baseUrl: providerConfig.baseUrl,
      requestedModelId: params.requestedModelId,
      isProxyBaseUrl: providerConfig.isProxyBaseUrl,
      codexHome,
    }),
    authMethodId: getCodexAuthMethodId(apiKey),
    session: {
      cwd: params.cwd,
      mcpServers: params.mcpServers,
    },
    ...(existingSessionIdForProvider
      ? { existingSessionId: existingSessionIdForProvider }
      : {}),
    persistSession: true,
  })

  providerSessions.set(params.subChatId, {
    provider,
    cwd: params.cwd,
    authFingerprint,
    mcpFingerprint: params.mcpFingerprint,
    providerFingerprint: providerConfig.providerFingerprint,
    requestedModelId: params.requestedModelId,
  })

  return provider
}

function inputSafePathSegment(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-")
  return normalized.length > 0 ? normalized : "default"
}

function cleanupProvider(subChatId: string): void {
  const existing = providerSessions.get(subChatId)
  if (!existing) return

  existing.provider.cleanup()
  providerSessions.delete(subChatId)
}

export const codexRouter = router({
  getIntegration: publicProcedure.query(() => {
    const preset = getActiveProvider()
    const apiKey = getProviderApiKey(preset.id)
    const state: CodexIntegrationState = apiKey
      ? "connected_api_key"
      : "not_logged_in"

    return {
      state,
      isConnected: Boolean(apiKey),
      rawOutput: `Active provider: ${preset.name}`,
      exitCode: 0,
      provider: preset,
    }
  }),

  logout: publicProcedure.mutation(() => {
    const preset = getActiveProvider()
    saveProviderApiKey(preset.id, "")

    return {
      success: true,
      state: "not_logged_in" as const,
      isConnected: false,
      logoutExitCode: 0,
      logoutOutput: `Cleared API key for ${preset.name}`,
      statusOutput: `Active provider: ${preset.name}`,
    }
  }),

  startLogin: publicProcedure.mutation(() => {
    const preset = getActiveProvider()
    const sessionId = crypto.randomUUID()
    const session: CodexLoginSession = {
      id: sessionId,
      process: null,
      state: "error",
      output: `Interactive Codex login is disabled. Save an API key for ${preset.name} in Settings > Providers.`,
      url: null,
      error: `Provider ${preset.name} uses app-managed API keys.`,
      exitCode: 1,
    }

    loginSessions.set(sessionId, session)
    return toLoginSessionResponse(session)
  }),

  getLoginSession: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
      }),
    )
    .query(({ input }) => {
      const session = loginSessions.get(input.sessionId)
      if (!session) {
        throw new Error("Codex login session not found")
      }

      return toLoginSessionResponse(session)
    }),

  cancelLogin: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
      }),
    )
    .mutation(({ input }) => {
      const session = loginSessions.get(input.sessionId)
      if (!session) {
        return { success: true, found: false }
      }

      session.state = "cancelled"
      session.error = null

      if (session.process && !session.process.killed) {
        session.process.kill("SIGTERM")
      }

      return { success: true, found: true, session: toLoginSessionResponse(session) }
    }),

  getAllMcpConfig: publicProcedure.query(async () => {
    try {
      return await getAllCodexMcpConfigHandler()
    } catch (error) {
      console.error("[codex.getAllMcpConfig] Error:", error)
      return {
        groups: [],
        error: extractCodexError(error).message,
      }
    }
  }),

  refreshMcpConfig: publicProcedure.mutation(() => {
    clearCodexMcpCache()
    return { success: true }
  }),

  addMcpServer: publicProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1)
          .regex(
            /^[a-zA-Z0-9_-]+$/,
            "Name must contain only letters, numbers, underscores, and hyphens",
          ),
        scope: z.enum(["global", "project"]),
        transport: z.enum(["stdio", "http"]),
        command: z.string().optional(),
        args: z.array(z.string()).optional(),
        url: z.string().url().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.scope !== "global") {
        throw new Error("Codex MCP currently supports global scope only.")
      }

      const args = ["mcp", "add", input.name.trim()]
      if (input.transport === "http") {
        const url = input.url?.trim()
        if (!url) {
          throw new Error("URL is required for HTTP servers.")
        }
        args.push("--url", url)
      } else {
        const command = input.command?.trim()
        if (!command) {
          throw new Error("Command is required for stdio servers.")
        }

        args.push("--", command, ...(input.args || []))
      }

      await runCodexCliChecked(args)
      clearCodexMcpCache()
      return { success: true }
    }),

  removeMcpServer: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        scope: z.enum(["global", "project"]).default("global"),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.scope !== "global") {
        throw new Error("Codex MCP currently supports global scope only.")
      }

      await runCodexCliChecked(["mcp", "remove", input.name.trim()])
      clearCodexMcpCache()
      return { success: true }
    }),

  startMcpOAuth: publicProcedure
    .input(
      z.object({
        serverName: z.string().min(1),
        projectPath: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const projectPath = input.projectPath?.trim()
        await runCodexCliChecked(["mcp", "login", input.serverName.trim()], {
          cwd: projectPath && projectPath.length > 0 ? projectPath : undefined,
        })
        clearCodexMcpCache()
        return { success: true as const }
      } catch (error) {
        return {
          success: false as const,
          error: extractCodexError(error).message,
        }
      }
    }),

  logoutMcpServer: publicProcedure
    .input(
      z.object({
        serverName: z.string().min(1),
        projectPath: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const projectPath = input.projectPath?.trim()
        await runCodexCliChecked(["mcp", "logout", input.serverName.trim()], {
          cwd: projectPath && projectPath.length > 0 ? projectPath : undefined,
        })
        clearCodexMcpCache()
        return { success: true as const }
      } catch (error) {
        return {
          success: false as const,
          error: extractCodexError(error).message,
        }
      }
    }),

  chat: publicProcedure
    .input(
      z
        .object({
          subChatId: z.string(),
          chatId: z.string(),
          runId: z.string(),
          prompt: z.string(),
          model: z.string().optional(),
          cwd: z.string(),
          projectPath: z.string().optional(),
          mode: z.enum(["plan", "agent"]).default("agent"),
          sessionId: z.string().optional(),
          forceNewSession: z.boolean().optional(),
          images: z.array(imageAttachmentSchema).optional(),
          authConfig: z
            .object({
              apiKey: z.string().min(1),
            })
            .optional(),
        })
        .transform((value) => ({
          ...value,
          cwd: value.cwd.trim(),
          projectPath: value.projectPath?.trim() || undefined,
        })),
    )
    .subscription(({ input }) => {
      return observable<any>((emit) => {
        const existingStream = activeStreams.get(input.subChatId)
        if (existingStream) {
          existingStream.cancelRequested = true
          existingStream.controller.abort()
          // Ensure old run cannot continue emitting after supersede.
          cleanupProvider(input.subChatId)
        }

        const abortController = new AbortController()
        activeStreams.set(input.subChatId, {
          runId: input.runId,
          controller: abortController,
          cancelRequested: false,
        })

        let isActive = true

        const safeEmit = (chunk: any) => {
          if (!isActive) return
          try {
            emit.next(chunk)
          } catch {
            isActive = false
          }
        }

        const safeComplete = () => {
          if (!isActive) return
          isActive = false
          try {
            emit.complete()
          } catch {
            // Ignore double completion
          }
        }

        ;(async () => {
          try {
            const resolvedWorkspace = resolveWorkspaceForChat(
              input.chatId,
              input.cwd,
              input.projectPath,
            )

            if (resolvedWorkspace) {
              input.cwd = resolvedWorkspace.cwd
              input.projectPath = resolvedWorkspace.projectPath
            }

            if (!existsSync(input.cwd)) {
              safeEmit({
                type: "error",
                errorText: `Invalid local workspace: Local workspace path does not exist: ${input.cwd}`,
                debugInfo: {
                  category: "INVALID_LOCAL_WORKSPACE",
                  context: "Invalid local workspace",
                  cwd: input.cwd,
                  mode: input.mode,
                  projectPath: input.projectPath,
                },
              })
              safeEmit({ type: "finish" })
              safeComplete()
              return
            }

            const db = getDatabase()

            const existingSubChat = db
              .select()
              .from(subChats)
              .where(eq(subChats.id, input.subChatId))
              .get()

            if (!existingSubChat) {
              throw new Error("Sub-chat not found")
            }

            const existingMessages = parseStoredMessages(existingSubChat.messages)
            const requestedModelId =
              extractCodexModelId(input.model) || DEFAULT_CODEX_MODEL
            const activeProvider = getActiveProvider()
            const acpModelId = resolveAcpModelId(requestedModelId)
            const upstreamModelId = preprocessCodexModelName({
              modelId: requestedModelId,
              preset: activeProvider,
            })
            const metadataModel = upstreamModelId

            const lastMessage = existingMessages[existingMessages.length - 1]
            const isDuplicatePrompt =
              lastMessage?.role === "user" &&
              extractPromptFromStoredMessage(lastMessage) === input.prompt

            let messagesForStream = existingMessages
            const isAuthoritativeRun = () => {
              const currentStream = activeStreams.get(input.subChatId)
              return !currentStream || currentStream.runId === input.runId
            }

            const persistSubChatMessages = (messages: any[]) => {
              if (!isAuthoritativeRun()) {
                return false
              }

              db.update(subChats)
                .set({
                  messages: JSON.stringify(messages),
                  updatedAt: new Date(),
                })
                .where(eq(subChats.id, input.subChatId))
                .run()
              return true
            }

            const cleanAssistantMessageForPersistence = (message: any) => {
              if (!message || message.role !== "assistant") return message
              if (!Array.isArray(message.parts)) return message

              const cleanedParts = message.parts.filter(
                (part: any) => part?.state !== "input-streaming",
              )

              if (cleanedParts.length === 0) {
                return null
              }

              const cleanedMessage = {
                ...message,
                parts: cleanedParts,
              }

              const normalizedMessage = normalizeCodexAssistantMessage(cleanedMessage, {
                normalizeState: true,
              })

              if (!normalizedMessage || !Array.isArray((normalizedMessage as any).parts)) {
                return normalizedMessage
              }

              if (hasAssistantTextPart((normalizedMessage as any).parts)) {
                return normalizedMessage
              }

              return {
                ...(normalizedMessage as any),
                parts: [
                  ...(normalizedMessage as any).parts,
                  {
                    type: "text",
                    text: buildCodexFallbackSummary((normalizedMessage as any).parts),
                  },
                ],
              }
            }

            if (!isDuplicatePrompt) {
              const userMessage = {
                id: crypto.randomUUID(),
                role: "user",
                parts: buildUserParts(input.prompt, input.images),
                metadata: { model: metadataModel },
              }

              messagesForStream = [...existingMessages, userMessage]

              db.update(subChats)
                .set({
                  messages: JSON.stringify(messagesForStream),
                  updatedAt: new Date(),
                })
                .where(eq(subChats.id, input.subChatId))
                .run()
            }

            if (input.forceNewSession) {
              cleanupProvider(input.subChatId)
            }

            let mcpSnapshot: CodexMcpSnapshot = {
              mcpServersForSession: [],
              groups: [],
              fingerprint: getCodexMcpFingerprint([]),
              fetchedAt: Date.now(),
              toolsResolved: false,
            }
            try {
              const resolvedProjectPathFromCwd = resolveProjectPathFromWorktree(
                input.cwd,
              )
              const mcpLookupPath =
                input.projectPath || resolvedProjectPathFromCwd || input.cwd
              mcpSnapshot = await resolveCodexMcpSnapshot({
                lookupPath: mcpLookupPath,
              })
            } catch (mcpError) {
              console.error("[codex] Failed to resolve MCP servers:", mcpError)
            }

            const provider = await getOrCreateProvider({
              subChatId: input.subChatId,
              cwd: input.cwd,
              mcpServers: mcpSnapshot.mcpServersForSession,
              mcpFingerprint: mcpSnapshot.fingerprint,
              requestedModelId,
              existingSessionId:
                input.forceNewSession
                  ? undefined
                  : input.sessionId ?? getLastSessionId(existingMessages),
              authConfig: input.authConfig,
            })

            const startedAt = Date.now()
            let latestSessionId =
              provider.getSessionId() ||
              input.sessionId ||
              getLastSessionId(existingMessages)
            const modelRequest = beginLoggedModelCall({
              sessionId: latestSessionId || input.subChatId,
              provider: getActiveProvider().id,
              baseUrl: getActiveProvider().baseUrl,
              model: upstreamModelId,
              messageCount: messagesForStream.length + 1,
              systemPromptBytes: 0,
              lastUserMessage: input.prompt,
              toolCount: Object.keys(provider.tools || {}).length,
            })
            logger.agent.info("session_started", {
              sessionId: latestSessionId || input.subChatId,
              subChatId: input.subChatId,
              projectPath: input.projectPath || input.cwd,
              provider: getActiveProvider().id,
              model: upstreamModelId,
              acpModelId,
            })
            let usagePromise: Promise<CodexUsageMetadata | null> | null = null
            let firstChunkLogged = false
            let finishReason: string | undefined
            let toolCallCount = 0
            let sawTextDelta = false

            const resolveUsageOnce = (): Promise<CodexUsageMetadata | null> => {
              if (usagePromise) return usagePromise

              const sessionId = latestSessionId || provider.getSessionId()
              if (!sessionId) {
                return Promise.resolve(null)
              }

              usagePromise = pollUsage(sessionId, {
                notBeforeTimestampMs: startedAt,
              }).catch(() => null)
              return usagePromise
            }

            const result = streamText({
              model: provider.languageModel(acpModelId),
              messages: [
                {
                  role: "user",
                  content: buildModelMessageContent(input.prompt, input.images),
                },
              ],
              tools: provider.tools,
              abortSignal: abortController.signal,
            })

            const uiStream = result.toUIMessageStream({
              originalMessages: messagesForStream,
              generateMessageId: () => crypto.randomUUID(),
              messageMetadata: ({ part }) => {
                const sessionId = provider.getSessionId() || undefined
                if (sessionId) {
                  latestSessionId = sessionId
                }

                if (part.type === "finish") {
                  finishReason = part.finishReason
                  return {
                    model: metadataModel,
                    sessionId,
                    durationMs: Date.now() - startedAt,
                    resultSubtype: part.finishReason === "error" ? "error" : "success",
                  }
                }

                if (sessionId) {
                  return {
                    model: metadataModel,
                    sessionId,
                  }
                }

                return { model: metadataModel }
              },
              onFinish: async ({ responseMessage, isContinuation }) => {
                try {
                  const usageMetadata = await resolveUsageOnce()
                  const responseWithUsage = usageMetadata
                    ? {
                        ...responseMessage,
                        metadata: {
                          ...((responseMessage as any)?.metadata || {}),
                          ...usageMetadata,
                        },
                      }
                    : responseMessage
                  const cleanedResponseMessage =
                    cleanAssistantMessageForPersistence(responseWithUsage)
                  modelRequest.complete({
                    httpStatus: 200,
                    inputTokens: usageMetadata?.inputTokens,
                    outputTokens: usageMetadata?.outputTokens,
                    stopReason: finishReason,
                    responsePreview: getResponsePreview(cleanedResponseMessage),
                    toolCallCount,
                  })
                  logger.agent.info("session_ended", {
                    sessionId: latestSessionId || input.subChatId,
                    subChatId: input.subChatId,
                    durationMs: Date.now() - startedAt,
                    totalTokens: usageMetadata?.totalTokens,
                    exitCode: 0,
                  })

                  if (!cleanedResponseMessage) {
                    persistSubChatMessages(messagesForStream)
                    return
                  }

                  const messagesToPersist = [
                    ...(isContinuation
                      ? messagesForStream.slice(0, -1)
                      : messagesForStream),
                    cleanedResponseMessage,
                  ]

                  persistSubChatMessages(messagesToPersist)
                } catch (error) {
                  console.error("[codex] Failed to persist messages:", error)
                }
              },
              onError: (error) => extractCodexError(error).message,
            })

            const reader = uiStream.getReader()
            let pendingFinishChunk: any | null = null
            let receivedChunkCount = 0
            while (true) {
              const next = await Promise.race([
                reader.read().then((result) => ({ kind: "chunk" as const, result })),
                sleep(CODEX_STREAM_IDLE_TIMEOUT_MS).then(() => ({ kind: "timeout" as const })),
              ])

              if (next.kind === "timeout") {
                logger.agent.warn("stream_idle_timeout", {
                  sessionId: latestSessionId || input.subChatId,
                  subChatId: input.subChatId,
                  idleMs: CODEX_STREAM_IDLE_TIMEOUT_MS,
                  receivedChunkCount,
                })

                // If we already streamed content, gracefully end the stream instead of hanging forever.
                if (receivedChunkCount > 0) {
                  const usageMetadata = await resolveUsageOnce()
                  if (usageMetadata) {
                    safeEmit({
                      type: "message-metadata",
                      messageMetadata: usageMetadata,
                    })
                  }
                  safeEmit({ type: "finish" })
                  safeComplete()
                  return
                }

                throw new Error(
                  `Codex stream idle timeout after ${CODEX_STREAM_IDLE_TIMEOUT_MS}ms`,
                )
              }

              const { done, value } = next.result
              if (done) break
              receivedChunkCount += 1

              modelRequest.markStreamChunk()
              if (!firstChunkLogged) {
                firstChunkLogged = true
                logger.agent.info("first_token", {
                  sessionId: latestSessionId || input.subChatId,
                  latencyMs: Date.now() - startedAt,
                })
              }

              if (value?.type === "error") {
                const normalized = extractCodexError(value)

                if (isCodexAuthError(normalized)) {
                  safeEmit({ ...value, type: "auth-error", errorText: normalized.message })
                } else {
                  safeEmit({ ...value, errorText: normalized.message })
                }
                continue
              }

              if (value?.type === "finish") {
                pendingFinishChunk = value
                continue
              }

              if (value?.type === "text-delta" && typeof value?.delta === "string" && value.delta.trim().length > 0) {
                sawTextDelta = true
              }

              if (value?.type === "text-end") {
                sawTextDelta = true
              }

              if (value?.type === "tool-input-available") {
                toolCallCount += 1
                logger.agent.debug("tool_called", {
                  sessionId: latestSessionId || input.subChatId,
                  tool: value.toolName,
                  inputPreview: JSON.stringify(value.input).slice(0, 200),
                })
              }

              if (value?.type === "tool-output-available") {
                logger.agent.debug("tool_result", {
                  sessionId: latestSessionId || input.subChatId,
                  tool: value.toolName,
                  success: true,
                  outputPreview: JSON.stringify(value.output).slice(0, 200),
                })
              }

              safeEmit(value)
            }

            if (pendingFinishChunk) {
              const usageMetadata = await resolveUsageOnce()
              if (usageMetadata) {
                safeEmit({
                  type: "message-metadata",
                  messageMetadata: usageMetadata,
                })
              }
              if (!sawTextDelta) {
                const fallbackText = buildCodexFallbackSummary(
                  (pendingFinishChunk as any)?.messageMetadata?.parts || [],
                )
                safeEmit({ type: "text-delta", delta: fallbackText })
                safeEmit({ type: "text-end" })
              }
              safeEmit(pendingFinishChunk)
            } else {
              if (!sawTextDelta) {
                safeEmit({
                  type: "text-delta",
                  delta: "Done. Task completed.",
                })
                safeEmit({ type: "text-end" })
              }
              safeEmit({ type: "finish" })
            }

            safeComplete()
          } catch (error) {
            const normalized = extractCodexError(error)

            console.error("[codex] chat stream error:", error)
            modelRequest.fail(error)
            logger.agent.error("session_crashed", {
              sessionId: latestSessionId || input.subChatId,
              subChatId: input.subChatId,
              error: normalized.message,
              exitCode: null,
            })
            if (isCodexAuthError(normalized)) {
              safeEmit({ type: "auth-error", errorText: normalized.message })
            } else {
              safeEmit({ type: "error", errorText: normalized.message })
            }
            safeEmit({ type: "finish" })
            safeComplete()
          } finally {
            const activeStream = activeStreams.get(input.subChatId)
            if (activeStream?.runId === input.runId) {
              const shouldCleanupProvider =
                abortController.signal.aborted || activeStream.cancelRequested
              if (shouldCleanupProvider) {
                cleanupProvider(input.subChatId)
              }
              activeStreams.delete(input.subChatId)
            }
          }
        })()

        return () => {
          isActive = false
          abortController.abort()

          const activeStream = activeStreams.get(input.subChatId)
          if (activeStream?.runId === input.runId) {
            activeStream.cancelRequested = true
          }
        }
      })
    }),

  cancel: publicProcedure
    .input(
      z.object({
        subChatId: z.string(),
        runId: z.string(),
      }),
    )
    .mutation(({ input }) => {
      const activeStream = activeStreams.get(input.subChatId)
      if (!activeStream) {
        return { cancelled: false, ignoredStale: false }
      }

      if (activeStream.runId !== input.runId) {
        return { cancelled: false, ignoredStale: true }
      }

      activeStream.cancelRequested = true
      activeStream.controller.abort()

      return { cancelled: true, ignoredStale: false }
    }),

  cleanup: publicProcedure
    .input(z.object({ subChatId: z.string() }))
    .mutation(({ input }) => {
      cleanupProvider(input.subChatId)

      const activeStream = activeStreams.get(input.subChatId)
      if (activeStream) {
        activeStream.controller.abort()
        activeStreams.delete(input.subChatId)
      }

      return { success: true }
    }),
})
