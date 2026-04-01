import ReactDOM from "react-dom/client"
import log from "electron-log/renderer"
import { App } from "./App"
import "./styles/globals.css"
import { preloadDiffHighlighter } from "./lib/themes/diff-view-highlighter"
import { rlog } from "./lib/logger"

log.transports.console.level = "debug"

// Suppress ResizeObserver loop error - this is a non-fatal browser warning
// that can occur when layout changes trigger observation callbacks
// Common with virtualization libraries and diff viewers
const resizeObserverErr = /ResizeObserver loop/

// Handle both error event and unhandledrejection
window.addEventListener("error", (e) => {
  if (e.message && resizeObserverErr.test(e.message)) {
    e.stopImmediatePropagation()
    e.preventDefault()
    return false
  }
})

// Also override window.onerror for broader coverage
const originalOnError = window.onerror
window.onerror = (message, source, lineno, colno, error) => {
  if (typeof message === "string" && resizeObserverErr.test(message)) {
    return true // Suppress the error
  }
  if (originalOnError) {
    return originalOnError(message, source, lineno, colno, error)
  }
  return false
}

const rootElement = document.getElementById("root")
const loadingOverlay = document.querySelector(".loading-container")

const CLOUD_ONLY_KEY_SUFFIXES = new Set([
  "agents:selectedTeamId",
  "agents:chat-source-mode",
  "preferences:beta-automations-enabled",
  "onboarding:anthropic-completed",
  "onboarding:codex-completed",
  "onboarding:codex-auth-method",
  "onboarding:codex-api-key",
  "21st-session-info",
])

const SAFE_WINDOW_KEY_SUFFIXES = new Set([
  "agents:selectedProject",
  "agents:selectedChatId",
  "agents:selectedChatIsRemote",
  "agents-sidebar-open",
  "agents-preview-sidebar-open",
  "agents-subchats-mode",
])

const SAFE_GLOBAL_KEYS = new Set([
  "theme",
  "preferences:theme",
  "preferences:beta-kanban-enabled",
  "preferences:ctrl-tab-target",
  "preferences:show-workspace-icon",
  "preferences:default-agent-mode",
])


function normalizeStorageKey(key: string): string {
  return key.replace(/^[^:]+:/, "")
}

function isTransientSubChatKey(key: string): boolean {
  return /(^|:)?agent-(open|active|pinned|split|splitOrigin|splitPanes|splitRatios)-sub-chats-/.test(
    key,
  )
}

function sanitizePersistedState(): void {
  const parseJsonSafely = (key: string, value: string | null) => {
    if (value === null) return null
    try {
      return JSON.parse(value)
    } catch {
      localStorage.removeItem(key)
      return null
    }
  }

  const allKeys = Object.keys(localStorage)
  for (const key of allKeys) {
    const normalizedKey = normalizeStorageKey(key)

    if (CLOUD_ONLY_KEY_SUFFIXES.has(normalizedKey)) {
      localStorage.removeItem(key)
      continue
    }

    if (isTransientSubChatKey(key)) {
      localStorage.removeItem(key)
      continue
    }

    const parsed = parseJsonSafely(key, localStorage.getItem(key))
    if (parsed === null && localStorage.getItem(key) === null) {
      continue
    }

    if (
      SAFE_WINDOW_KEY_SUFFIXES.has(normalizedKey) ||
      SAFE_GLOBAL_KEYS.has(key) ||
      SAFE_GLOBAL_KEYS.has(normalizedKey)
    ) {
      if (normalizedKey === "agents:selectedProject") {
        if (
          parsed !== null &&
          (typeof parsed !== "object" ||
            Array.isArray(parsed) ||
            ("id" in parsed && typeof (parsed as { id?: unknown }).id !== "string") ||
            ("path" in parsed && typeof (parsed as { path?: unknown }).path !== "string"))
        ) {
          localStorage.removeItem(key)
        }
      }

      if (normalizedKey === "agents:selectedChatId" && parsed !== null && typeof parsed !== "string") {
        localStorage.removeItem(key)
      }

      if (
        normalizedKey === "agents:selectedChatIsRemote" &&
        parsed !== null &&
        typeof parsed !== "boolean"
      ) {
        localStorage.removeItem(key)
      }

      if (normalizedKey === "agents-subchats-mode" && parsed !== null && parsed !== "tabs" && parsed !== "sidebar") {
        localStorage.removeItem(key)
      }
    }
  }

  // Force desktop app to start from a local, non-remote chat context.
  // These keys are safe to overwrite because they only affect initial shell routing.
  for (const key of allKeys) {
    const normalizedKey = normalizeStorageKey(key)
    if (normalizedKey === "agents:selectedChatId") {
      localStorage.removeItem(key)
    }
    if (normalizedKey === "agents:selectedChatIsRemote") {
      localStorage.setItem(key, JSON.stringify(false))
    }
    if (normalizedKey === "agents:chat-source-mode") {
      localStorage.setItem(key, JSON.stringify("local"))
    }
  }

  // One-time theme migration:
  // If user is still on default system dark theme (21st-dark) and has not explicitly
  // picked a full theme, move default dark palette to Code King.
  const selectedThemeKeys = allKeys.filter(
    (key) => normalizeStorageKey(key) === "selected-full-theme-id",
  )
  const systemDarkThemeKeys = allKeys.filter(
    (key) => normalizeStorageKey(key) === "system-dark-theme-id",
  )

  const selectedThemeKey = selectedThemeKeys[0] ?? "preferences:selected-full-theme-id"
  const systemDarkThemeKey = systemDarkThemeKeys[0] ?? "preferences:system-dark-theme-id"

  const selectedThemeValue = parseJsonSafely(selectedThemeKey, localStorage.getItem(selectedThemeKey))
  const systemDarkThemeValue = parseJsonSafely(systemDarkThemeKey, localStorage.getItem(systemDarkThemeKey))

  const usingSystemMode =
    selectedThemeValue === null || typeof selectedThemeValue === "undefined"

  if (selectedThemeValue === "21st-dark") {
    localStorage.setItem(selectedThemeKey, JSON.stringify("code-king-dark"))
  }

  if (usingSystemMode && (systemDarkThemeValue === null || systemDarkThemeValue === "21st-dark")) {
    localStorage.setItem(systemDarkThemeKey, JSON.stringify("code-king-dark"))
  }
}

function hideLoadingOverlay(): void {
  const overlay = loadingOverlay as HTMLElement | null
  if (!overlay) return

  overlay.style.opacity = "0"
  overlay.style.pointerEvents = "none"

  window.setTimeout(() => {
    overlay.remove()
  }, 180)
}

function showBootstrapError(message: string): void {
  if (!rootElement) return
  rootElement.innerHTML = `<pre style="color:#f87171;padding:20px;white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, monospace">${message}</pre>`
  hideLoadingOverlay()
}

function runDeferredInitializers(): void {
  // WDYR is dev-only and should never block app bootstrap.
  if (import.meta.env.DEV) {
    void import("./wdyr").catch((error) => {
      console.warn("[bootstrap] Failed to load WDYR", error)
      rlog.app.warn("Failed to load WDYR", { error: String(error) })
    })
  }

  // Sentry is optional and should not block the first render.
  if (import.meta.env.PROD) {
    void import("@sentry/electron/renderer")
      .then((Sentry) => {
        Sentry.init()
        rlog.app.info("Sentry renderer initialized")
      })
      .catch((error) => {
        console.warn("[bootstrap] Failed to initialize Sentry", error)
        rlog.app.warn("Failed to initialize Sentry", { error: String(error) })
      })
  }

  // Preload shiki in the background after first paint.
  window.setTimeout(() => {
    try {
      preloadDiffHighlighter()
      rlog.app.debug("Preloading diff highlighter")
    } catch (error) {
      console.warn("[bootstrap] Failed to preload diff highlighter", error)
      rlog.app.warn("Failed to preload diff highlighter", { error: String(error) })
    }
  }, 0)
}

if (rootElement) {
  try {
    sanitizePersistedState()
    rlog.app.info("Renderer bootstrap starting")
    ReactDOM.createRoot(rootElement).render(<App />)
    rlog.app.info("Renderer mounted")
    const observer = new MutationObserver(() => {
      if (rootElement.childNodes.length > 0) {
        hideLoadingOverlay()
        observer.disconnect()
      }
    })
    observer.observe(rootElement, { childList: true, subtree: false })
    window.requestAnimationFrame(() => {
      if (rootElement.childNodes.length > 0) {
        hideLoadingOverlay()
        observer.disconnect()
      }
    })
    runDeferredInitializers()
  } catch (error) {
    console.error("[bootstrap] Failed to mount renderer", error)
    rlog.app.error("Failed to mount renderer", { error: String(error) })
    showBootstrapError(`Renderer bootstrap failed:\n${String(error)}`)
  }
} else {
  console.error("[bootstrap] Missing #root element")
  rlog.app.error("Missing #root element")
}
