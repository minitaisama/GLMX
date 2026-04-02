#!/usr/bin/env node

import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const isWindows = process.platform === "win32"
const npmCommand = isWindows ? "npm.cmd" : "npm"
const tailCommand = isWindows ? "powershell" : "tail"

function resolveLogCandidates() {
  const home = homedir()
  if (process.platform === "darwin") {
    return [
      join(home, "Library", "Logs", "GLMX Dev"),
      join(home, "Library", "Logs", "GLMX"),
    ]
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || join(home, "AppData", "Roaming")
    return [
      join(appData, "GLMX Dev", "logs"),
      join(appData, "GLMX", "logs"),
    ]
  }
  return [
    join(home, ".config", "GLMX Dev", "logs"),
    join(home, ".config", "GLMX", "logs"),
  ]
}

function readFirstExistingLogDir() {
  const candidates = resolveLogCandidates()
  return candidates.find((path) => existsSync(path))
}

console.log("[GLMX] Starting standalone dev runner...")
console.log("[GLMX] This command keeps app + logs in one terminal.")

const devProc = spawn(
  npmCommand,
  ["run", "dev"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      GLMX_STANDALONE: "1",
    },
  },
)

let tailProc = null
setTimeout(() => {
  const logDir = readFirstExistingLogDir()
  if (!logDir) {
    console.log("[GLMX] Log folder not found yet. Open Settings > Logs once app boots.")
    return
  }

  const mainLog = join(logDir, "main.log")
  const rendererLog = join(logDir, "renderer.log")
  const targets = [mainLog, rendererLog].filter((p) => existsSync(p))

  if (targets.length === 0) {
    console.log("[GLMX] No log files found yet in", logDir)
    return
  }

  console.log(`[GLMX] Tailing logs: ${targets.join(", ")}`)
  if (isWindows) {
    const powerShellCommand = targets
      .map((target) => `Get-Content -Path '${target}' -Wait -Tail 20`)
      .join("; ")
    tailProc = spawn(tailCommand, ["-NoProfile", "-Command", powerShellCommand], {
      stdio: "inherit",
    })
  } else {
    tailProc = spawn(tailCommand, ["-n", "20", "-f", ...targets], {
      stdio: "inherit",
    })
  }
}, 3000)

function shutdown(signal) {
  if (tailProc && !tailProc.killed) {
    tailProc.kill("SIGTERM")
  }
  if (!devProc.killed) {
    devProc.kill("SIGTERM")
  }
  setTimeout(() => process.exit(0), 200)
  console.log(`[GLMX] Stopped (${signal})`)
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

devProc.on("exit", (code) => {
  if (tailProc && !tailProc.killed) {
    tailProc.kill("SIGTERM")
  }
  process.exit(code ?? 0)
})
