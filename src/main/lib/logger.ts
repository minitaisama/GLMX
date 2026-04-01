import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import log from "electron-log"
import { app } from "electron"

type LogFileKind = "main" | "renderer" | "model" | "quality"

const LOG_FORMAT =
  "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] [{scope}] {text}"
const LOG_MAX_SIZE = 20 * 1024 * 1024

const mainLog = log
const rendererLog = log.create({ logId: "renderer" })
const modelLog = log.create({ logId: "model" })
const qualityLog = log.create({ logId: "quality" })

function getLogFilePath(kind: LogFileKind): string {
  return path.join(app.getPath("logs"), `${kind}.log`)
}

function configureLogger(
  instance: typeof log,
  fileName: `${LogFileKind}.log`,
): void {
  instance.transports.file.resolvePathFn = () =>
    path.join(app.getPath("logs"), fileName)
  instance.transports.file.level = "debug"
  instance.transports.file.maxSize = LOG_MAX_SIZE
  instance.transports.file.format = LOG_FORMAT
  instance.transports.console.level =
    process.env.NODE_ENV === "development" ? "debug" : "warn"
}

configureLogger(mainLog, "main.log")
configureLogger(rendererLog, "renderer.log")
configureLogger(modelLog, "model.log")
configureLogger(qualityLog, "quality.log")
mainLog.initialize()

export const logger = {
  app: mainLog.scope("app"),
  renderer: rendererLog.scope("renderer"),
  agent: mainLog.scope("agent"),
  session: mainLog.scope("session"),
  perf: mainLog.scope("perf"),
  git: mainLog.scope("git"),
  fs: mainLog.scope("fs"),
  trpc: mainLog.scope("trpc"),
  boot: mainLog.scope("boot"),
  zai: mainLog.scope("zai-config"),
  model: modelLog.scope("model"),
  quality: qualityLog.scope("quality"),
}

type LogLevel = "error" | "warn" | "info" | "debug"

function logAtLevel(
  scope: { error: Function; warn: Function; info: Function; debug: Function },
  level: LogLevel,
  message: string,
  payload?: Record<string, unknown>,
): void {
  switch (level) {
    case "error":
      scope.error(message, payload)
      return
    case "warn":
      scope.warn(message, payload)
      return
    case "debug":
      scope.debug(message, payload)
      return
    case "info":
    default:
      scope.info(message, payload)
  }
}

export function logAgentEvent(
  event: string,
  payload?: Record<string, unknown>,
): void {
  // Guard against legacy dynamic-dispatch patterns (e.g. logger.agent[event](...)).
  // We keep level selection explicit so unknown event names can never crash logging.
  const level: LogLevel = event === "session_crashed" ? "error" : "info"
  logAtLevel(logger.agent, level, event, payload)
}

export const logPaths = {
  main: () => getLogFilePath("main"),
  renderer: () => getLogFilePath("renderer"),
  model: () => getLogFilePath("model"),
  quality: () => getLogFilePath("quality"),
}

export function readLogTail(kind: LogFileKind, lineCount = 30): string[] {
  const filePath = getLogFilePath(kind)
  if (!existsSync(filePath)) return []

  const raw = readFileSync(filePath, "utf8")
  const lines = raw.split(/\r?\n/).filter(Boolean)
  return lines.slice(-lineCount)
}

export default logger
