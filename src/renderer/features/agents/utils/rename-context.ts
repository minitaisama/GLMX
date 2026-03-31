function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function sanitizeTitleSource(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/[#>*_[\]()-]/g, " ")
      .replace(/[“”"'`]/g, ""),
  )
}

type MessagePart = {
  type?: string
  text?: string
}

type ChatMessage = {
  role?: string
  parts?: MessagePart[]
}

function parseMessages(rawMessages: unknown): ChatMessage[] {
  if (Array.isArray(rawMessages)) return rawMessages as ChatMessage[]
  if (typeof rawMessages !== "string") return []

  try {
    const parsed = JSON.parse(rawMessages)
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : []
  } catch {
    return []
  }
}

export function extractRenameContext(rawMessages: unknown): string | null {
  const messages = parseMessages(rawMessages)

  for (const message of messages) {
    if (message.role !== "user") continue

    const text = (message.parts || [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text || "")
      .join(" ")

    const normalized = sanitizeTitleSource(text)
    if (normalized) return normalized
  }

  return null
}

export function buildRenameSuggestion(
  context: string | null | undefined,
  currentName?: string | null,
): string | null {
  const normalizedContext = sanitizeTitleSource(context || "")
  if (!normalizedContext) return null

  const suggestion =
    normalizedContext.length <= 25
      ? normalizedContext
      : `${normalizedContext.slice(0, 25).trim()}...`

  if (!suggestion) return null
  if (currentName && normalizeWhitespace(currentName) === suggestion) return null
  return suggestion
}

export function buildContextPreview(context: string | null | undefined): string | null {
  const normalizedContext = normalizeWhitespace(context || "")
  if (!normalizedContext) return null

  if (normalizedContext.length <= 140) return normalizedContext
  return `${normalizedContext.slice(0, 140).trim()}...`
}
