"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  Compass,
  FileText,
  Search,
  Wrench,
} from "lucide-react"
import { cn } from "../../../lib/utils"
import { ChatMarkdownRenderer } from "../../../components/chat-markdown-renderer"
import { TextShimmer } from "../../../components/ui/text-shimmer"
import { AgentToolInterrupted } from "./agent-tool-interrupted"
import { areToolPropsEqual } from "./agent-tool-utils"

interface ThinkingToolPart {
  type: string
  state: string
  input?: {
    text?: string
  }
  output?: {
    completed?: boolean
  }
  startedAt?: number
}

interface AgentThinkingToolProps {
  part: ThinkingToolPart
  chatStatus?: string
}

const PREVIEW_LENGTH = 80
const MAX_VISIBLE_EVENTS = 8
const EVENT_ROW_HEIGHT_PX = 44
const THINKING_VIEW_MODE_STORAGE_KEY = "glmx:thinking-view-mode"

type ThinkingEventType =
  | "thought"
  | "found"
  | "read"
  | "explored"
  | "implementation"
  | "result"

interface ThinkingEvent {
  type: ThinkingEventType
  text: string
}

type ThinkingViewMode = "compact" | "detailed"

function formatElapsedTime(ms: number): string {
  if (ms < 1000) return ""
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (remainingSeconds === 0) return `${minutes}m`
  return `${minutes}m ${remainingSeconds}s`
}

function detectEventType(line: string): ThinkingEventType {
  if (/^thought\b/i.test(line)) return "thought"
  if (
    /^(found|searched|searching|no matches|matched)\b/i.test(line)
  ) {
    return "found"
  }
  if (/^read\b/i.test(line)) return "read"
  if (/^explored\b/i.test(line)) return "explored"
  if (/^(implemented|done|completed|compacted)\b/i.test(line)) {
    return "result"
  }
  return "implementation"
}

function stripPrefix(line: string, type: ThinkingEventType): string {
  switch (type) {
    case "thought":
      return line.replace(/^thought\b[:\s-]*/i, "").trim()
    case "found":
      return line.replace(/^(found|searched|searching|no matches|matched)\b[:\s-]*/i, "").trim()
    case "read":
      return line.replace(/^read\b[:\s-]*/i, "").trim()
    case "explored":
      return line.replace(/^explored\b[:\s-]*/i, "").trim()
    case "result":
      return line.replace(/^(implemented|done|completed|compacted)\b[:\s-]*/i, "").trim()
    case "implementation":
    default:
      return line.trim()
  }
}

function parseThinkingEvents(text: string): ThinkingEvent[] {
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const events: ThinkingEvent[] = []

  for (const rawLine of rawLines) {
    // Keep raw markdown/code blocks out of the timeline view to avoid noisy rendering.
    if (rawLine.startsWith("```") || rawLine.startsWith("</") || rawLine.startsWith("<div")) {
      continue
    }

    const type = detectEventType(rawLine)
    const normalized = stripPrefix(rawLine, type) || rawLine
    const previous = events[events.length - 1]

    // Compact consecutive entries of same type into a single event.
    if (previous && previous.type === type) {
      if (!previous.text.toLowerCase().includes(normalized.toLowerCase())) {
        previous.text = `${previous.text} • ${normalized}`
      }
      continue
    }

    events.push({ type, text: normalized })
  }

  return events
}

const EVENT_META: Record<
  ThinkingEventType,
  {
    label: string
    icon: typeof Brain
    chipClass: string
    textClass: string
  }
> = {
  thought: {
    label: "Thought",
    icon: Brain,
    chipClass: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    textClass: "text-foreground/95",
  },
  found: {
    label: "Found",
    icon: Search,
    chipClass: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    textClass: "text-foreground/90",
  },
  read: {
    label: "Read",
    icon: FileText,
    chipClass: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    textClass: "text-foreground/90",
  },
  explored: {
    label: "Explored",
    icon: Compass,
    chipClass: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    textClass: "text-foreground/90",
  },
  implementation: {
    label: "Implementation",
    icon: Wrench,
    chipClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    textClass: "text-foreground/95",
  },
  result: {
    label: "Result",
    icon: CheckCircle2,
    chipClass: "bg-green-500/10 text-green-300 border-green-500/20",
    textClass: "text-foreground",
  },
}

export const AgentThinkingTool = memo(function AgentThinkingTool({
  part,
  chatStatus,
}: AgentThinkingToolProps) {
  const isPending =
    part.state !== "output-available" && part.state !== "output-error"
  const isActivelyStreaming = chatStatus === "streaming" || chatStatus === "submitted"
  const isStreaming = isPending && isActivelyStreaming
  const isInterrupted = isPending && !isActivelyStreaming && chatStatus !== undefined

  // Default: expanded while streaming, collapsed when done
  const [isExpanded, setIsExpanded] = useState(isStreaming)
  const scrollRef = useRef<HTMLDivElement>(null)
  const wasStreamingRef = useRef(isStreaming)

  // Auto-collapse when streaming ends (transition from true -> false)
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      setIsExpanded(false)
    }
    wasStreamingRef.current = isStreaming
  }, [isStreaming])

  // Elapsed time — ticks every second while streaming
  const startedAtRef = useRef(part.startedAt || Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!isStreaming) return
    const tick = () => setElapsedMs(Date.now() - startedAtRef.current)
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isStreaming])

  // Track whether content overflows the scroll container
  const [isOverflowing, setIsOverflowing] = useState(false)

  // Auto-scroll when expanded during streaming + check overflow
  useEffect(() => {
    if (isStreaming && isExpanded && scrollRef.current) {
      const el = scrollRef.current
      setIsOverflowing(el.scrollHeight > el.clientHeight)
      el.scrollTop = el.scrollHeight
    }
  }, [part.input?.text, isStreaming, isExpanded])

  const thinkingText = part.input?.text || ""
  const events = useMemo(() => parseThinkingEvents(thinkingText), [thinkingText])
  const [viewMode, setViewMode] = useState<ThinkingViewMode>(() => {
    if (typeof window === "undefined") return "detailed"
    const stored = window.localStorage.getItem(THINKING_VIEW_MODE_STORAGE_KEY)
    return stored === "compact" || stored === "detailed" ? stored : "detailed"
  })
  const orderedEvents = useMemo(() => {
    if (events.length <= 1) return events
    const nonResult = events.filter((event) => event.type !== "result")
    const result = events.filter((event) => event.type === "result")
    return [...nonResult, ...result]
  }, [events])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(THINKING_VIEW_MODE_STORAGE_KEY, viewMode)
  }, [viewMode])

  const previewText = useMemo(() => {
    if (events.length === 0) {
      return thinkingText.slice(0, PREVIEW_LENGTH).replace(/\n/g, " ")
    }
    return events
      .slice(0, 2)
      .map((event) => `${EVENT_META[event.type].label}: ${event.text}`)
      .join(" · ")
      .slice(0, PREVIEW_LENGTH * 2)
  }, [events, thinkingText])

  const elapsedDisplay = isStreaming ? formatElapsedTime(elapsedMs) : ""

  if (isInterrupted && !thinkingText) {
    return <AgentToolInterrupted toolName="Thinking" />
  }

  return (
    <div>
      {/* Header - always visible, clickable to toggle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="group flex items-start gap-1.5 py-1 px-2 cursor-pointer"
      >
        <div className="flex-1 min-w-0 flex items-center gap-1">
          <div className="text-xs flex items-center gap-1.5 min-w-0">
            <span className="font-medium whitespace-nowrap flex-shrink-0">
              {isStreaming ? (
                <TextShimmer
                  as="span"
                  duration={1.2}
                  className="inline-flex items-center text-xs leading-none h-4 m-0"
                >
                  Thinking
                </TextShimmer>
              ) : (
                <span className="text-muted-foreground">Thought</span>
              )}
            </span>
            {/* Preview when collapsed */}
            {!isExpanded && previewText && (
              <span className="text-muted-foreground/60 truncate">
                {previewText}
              </span>
            )}
            {!isExpanded && events.length > 0 && (
              <span className="text-muted-foreground/40 tabular-nums flex-shrink-0">
                {events.length}
              </span>
            )}
            {/* Elapsed time */}
            {elapsedDisplay && (
              <span className="text-muted-foreground/50 tabular-nums flex-shrink-0">
                {elapsedDisplay}
              </span>
            )}
            {/* Chevron */}
            <ChevronRight
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground/60 transition-transform duration-200 ease-out flex-shrink-0",
                isExpanded && "rotate-90",
                !isExpanded && "opacity-0 group-hover:opacity-100",
              )}
            />
          </div>
        </div>
        {isExpanded && orderedEvents.length > 0 && (
          <div
            className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 p-0.5 ml-2"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={cn(
                "px-1.5 py-0.5 text-[10px] rounded transition-colors",
                viewMode === "compact"
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setViewMode("compact")}
            >
              Compact
            </button>
            <button
              type="button"
              className={cn(
                "px-1.5 py-0.5 text-[10px] rounded transition-colors",
                viewMode === "detailed"
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setViewMode("detailed")}
            >
              Detailed
            </button>
          </div>
        )}
      </div>

      {/* Content - expanded while streaming, collapsible after */}
      {isExpanded && thinkingText && (
        <div className="relative mt-1">
          {/* Top gradient fade when streaming */}
          <div
            className={cn(
              "absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none transition-opacity duration-200",
              isStreaming && isOverflowing ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            ref={scrollRef}
            className={cn(
              "px-3 py-1",
              isStreaming && events.length > MAX_VISIBLE_EVENTS && "overflow-y-auto scrollbar-hide",
            )}
            style={
              isStreaming && events.length > MAX_VISIBLE_EVENTS
                ? { maxHeight: `${MAX_VISIBLE_EVENTS * EVENT_ROW_HEIGHT_PX}px` }
                : undefined
            }
          >
            {orderedEvents.length > 0 ? (
              <div className={cn(viewMode === "compact" ? "space-y-1" : "space-y-1.5")}>
                {orderedEvents.map((event, index) => {
                  const meta = EVENT_META[event.type]
                  const Icon = meta.icon
                  return (
                    <div
                      key={`${event.type}-${index}`}
                      className={cn(
                        "rounded-md border border-border/50 bg-muted/20 px-2",
                        viewMode === "compact" ? "py-1" : "py-1.5",
                        event.type === "result" && "border-green-500/35 bg-green-500/5",
                      )}
                    >
                      <div className={cn("flex items-center gap-1.5", viewMode === "detailed" && "mb-1")}>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
                            meta.chipClass,
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                        {viewMode === "compact" && (
                          <p className={cn("text-xs leading-relaxed break-words truncate", meta.textClass)}>
                            {event.text}
                          </p>
                        )}
                      </div>
                      {viewMode === "detailed" && (
                        <p className={cn("text-xs leading-relaxed break-words", meta.textClass)}>
                          {event.text}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <ChatMarkdownRenderer content={thinkingText} size="sm" isStreaming={isStreaming} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}, areToolPropsEqual)
