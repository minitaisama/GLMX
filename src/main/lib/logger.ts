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
  git: mainLog.scope("git"),
  fs: mainLog.scope("fs"),
  trpc: mainLog.scope("trpc"),
  boot: mainLog.scope("boot"),
  zai: mainLog.scope("zai-config"),
  model: modelLog.scope("model"),
  quality: qualityLog.scope("quality"),
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
