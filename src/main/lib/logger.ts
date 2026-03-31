import { app } from "electron"
import log from "electron-log"
import fs from "node:fs/promises"
import path from "node:path"

export function getMainLogPath() {
  return path.join(app.getPath("logs"), "main.log")
}

log.transports.file.resolvePathFn = () => getMainLogPath()
log.transports.file.level = "debug"
log.transports.file.maxSize = 10 * 1024 * 1024
log.transports.file.format =
  "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] [{scope}] {text}"
log.transports.console.level =
  process.env.NODE_ENV === "development" ? "debug" : "warn"

export async function readMainLogTail(lineCount = 20): Promise<string[]> {
  try {
    const content = await fs.readFile(getMainLogPath(), "utf-8")
    const lines = content.split(/\r?\n/).filter(Boolean)
    return lines.slice(-lineCount)
  } catch {
    return []
  }
}

export const logger = {
  main: log.scope("main"),
  agent: log.scope("agent"),
  zai: log.scope("zai-config"),
  trpc: log.scope("trpc"),
  git: log.scope("git"),
  session: log.scope("session"),
  ipc: log.scope("ipc"),
  perf: log.scope("perf"),
}

export default logger
