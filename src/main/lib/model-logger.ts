import { randomUUID } from "node:crypto"
import { logger } from "./logger"

type ModelRequestMeta = {
  sessionId: string
  provider: string
  baseUrl?: string
  model: string
  messageCount: number
  systemPromptBytes: number
  lastUserMessage: string
  toolCount: number
  temperature?: number
  maxTokens?: number
}

type ModelResponseMeta = {
  httpStatus?: number
  inputTokens?: number
  outputTokens?: number
  stopReason?: string
  responsePreview?: string
  toolCallCount?: number
  totalChunks?: number
}

function preview(text: string | null | undefined, max = 200): string {
  if (!text) return ""
  return text.replace(/\s+/g, " ").trim().slice(0, max)
}

export function beginLoggedModelCall(meta: ModelRequestMeta) {
  const requestId = randomUUID().slice(0, 8)
  const startedAt = Date.now()
  let chunkCount = 0
  let streamStarted = false

  logger.model.info("request_sent", {
    requestId,
    sessionId: meta.sessionId,
    provider: meta.provider,
    baseUrl: meta.baseUrl,
    model: meta.model,
    messageCount: meta.messageCount,
    systemPromptBytes: meta.systemPromptBytes,
    lastUserMessagePreview: preview(meta.lastUserMessage),
    toolCount: meta.toolCount,
    temperature: meta.temperature,
    maxTokens: meta.maxTokens,
    timestamp: new Date(startedAt).toISOString(),
  })

  return {
    requestId,
    markStreamChunk() {
      chunkCount += 1
      if (!streamStarted) {
        streamStarted = true
        logger.model.info("stream_started", {
          requestId,
          sessionId: meta.sessionId,
        })
      }
    },
    complete(response: ModelResponseMeta) {
      const durationMs = Date.now() - startedAt
      logger.model.info("response_received", {
        requestId,
        sessionId: meta.sessionId,
        httpStatus: response.httpStatus,
        durationMs,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        stopReason: response.stopReason,
        responsePreview: preview(response.responsePreview),
        toolCallCount: response.toolCallCount ?? 0,
        timestamp: new Date().toISOString(),
      })

      if (streamStarted) {
        logger.model.info("stream_completed", {
          requestId,
          sessionId: meta.sessionId,
          totalChunks: response.totalChunks ?? chunkCount,
          durationMs,
        })
      }

      if ((response.outputTokens ?? 0) > 0 && (response.outputTokens ?? 0) < 50) {
        logger.quality.warn("low_token_response", {
          requestId,
          sessionId: meta.sessionId,
          outputTokens: response.outputTokens,
          stopReason: response.stopReason,
        })
      }

      if (response.stopReason === "max_tokens") {
        logger.quality.warn("context_truncated", {
          requestId,
          sessionId: meta.sessionId,
          truncatedTokens: response.outputTokens,
        })
      }

      if (!preview(response.responsePreview)) {
        logger.quality.warn("empty_response", {
          requestId,
          sessionId: meta.sessionId,
          stopReason: response.stopReason,
        })
      }
    },
    fail(error: unknown, response?: { httpStatus?: number; willRetry?: boolean; retryCount?: number }) {
      const durationMs = Date.now() - startedAt
      const normalized =
        error instanceof Error
          ? error
          : new Error(typeof error === "string" ? error : "Unknown model error")

      logger.model.error("request_failed", {
        requestId,
        sessionId: meta.sessionId,
        durationMs,
        httpStatus: response?.httpStatus,
        error: normalized.message,
        retryCount: response?.retryCount ?? 0,
        willRetry: response?.willRetry ?? false,
      })

      if (streamStarted) {
        logger.model.error("stream_error", {
          requestId,
          sessionId: meta.sessionId,
          error: normalized.message,
          chunksReceived: chunkCount,
        })
      }
    },
    malformedToolCall(tool: string, rawResponse: unknown, parseError: unknown) {
      logger.quality.error("tool_call_malformed", {
        requestId,
        sessionId: meta.sessionId,
        tool,
        rawResponse:
          typeof rawResponse === "string"
            ? rawResponse
            : JSON.stringify(rawResponse).slice(0, 1000),
        parseError:
          parseError instanceof Error ? parseError.message : String(parseError),
      })
    },
  }
}

export async function loggedModelCall<T>(
  meta: ModelRequestMeta,
  requestFn: () => Promise<{ result: T; response: ModelResponseMeta }>,
): Promise<T> {
  const request = beginLoggedModelCall(meta)

  try {
    const { result, response } = await requestFn()
    request.complete(response)
    return result
  } catch (error) {
    request.fail(error)
    throw error
  }
}
