"use client"

import { memo, useState, useEffect, useRef, useMemo } from "react"
import { ChevronRight, Loader2 } from "lucide-react"
import { cn } from "../../../lib/utils"
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

const PREVIEW_LENGTH = 60
const MAX_VISIBLE_LINES = 8
const LINE_HEIGHT_PX = 22

function cleanLine(line: string): string {
  return line.replace(/\s+/g, " ").trim()
}

function normalizeThinkingLines(text: string): string[] {
  return text
    .split("\n")
    .map(cleanLine)
    .filter(Boolean)
}

function truncateText(value: string, max = 88): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function formatElapsedTime(ms: number): string {
  if (ms < 1000) return ""
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (remainingSeconds === 0) return `${minutes}m`
  return `${minutes}m ${remainingSeconds}s`
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
  const reasoningLines = useMemo(
    () => normalizeThinkingLines(thinkingText),
    [thinkingText],
  )
  const latestVisibleLines = useMemo(() => {
    if (reasoningLines.length <= MAX_VISIBLE_LINES) return reasoningLines
    return reasoningLines.slice(-MAX_VISIBLE_LINES)
  }, [reasoningLines])

  const previewSource = reasoningLines[0] || thinkingText
  const previewText = truncateText(
    previewSource.slice(0, PREVIEW_LENGTH).replace(/\n/g, " "),
    PREVIEW_LENGTH,
  )

  const elapsedDisplay = isStreaming ? formatElapsedTime(elapsedMs) : ""

  if (isInterrupted && !thinkingText) {
    return <AgentToolInterrupted toolName="Thinking" />
  }

  return (
    <div>
      {/* Header - always visible, clickable to toggle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="group flex items-start gap-1.5 py-0.5 px-2 cursor-pointer"
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
      </div>

      {/* Content - expanded while streaming, collapsible after */}
      {isExpanded && reasoningLines.length > 0 && (
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
              "px-2 space-y-1",
              reasoningLines.length > MAX_VISIBLE_LINES &&
                "overflow-y-auto scrollbar-hide",
            )}
            style={
              reasoningLines.length > MAX_VISIBLE_LINES
                ? { maxHeight: `${MAX_VISIBLE_LINES * LINE_HEIGHT_PX}px` }
                : undefined
            }
          >
            {latestVisibleLines.map((line, idx) => (
              <div
                key={`${idx}-${line.slice(0, 20)}`}
                className="flex items-center gap-2 text-xs text-muted-foreground"
                title={line}
              >
                {isStreaming && idx === latestVisibleLines.length - 1 ? (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground/70" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                )}
                <span className="truncate">{truncateText(line, 140)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}, areToolPropsEqual)
