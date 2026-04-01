"use client"

import { memo, useState, useEffect, useRef } from "react"
import { ChevronRight, Loader2 } from "lucide-react"
import { useFileOpen } from "../mentions"
import { areExploringGroupPropsEqual } from "./agent-tool-utils"
import { cn } from "../../../lib/utils"

interface AgentExploringGroupProps {
  parts: any[]
  chatStatus?: string
  isStreaming: boolean
}

// Constants for rendering
const MAX_VISIBLE_TOOLS = 5
const TOOL_HEIGHT_PX = 24

function truncateMiddle(value: string, max = 90): string {
  if (value.length <= max) return value
  const keep = Math.floor((max - 1) / 2)
  return `${value.slice(0, keep)}…${value.slice(-keep)}`
}

function cleanInline(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim()
}

function formatPattern(value: unknown): string {
  const raw = cleanInline(value)
  if (!raw) return ""
  // Keep format consistent and readable in compact rows
  return raw.length > 64 ? `${raw.slice(0, 61)}...` : raw
}

function formatExplorationRow(part: any): { text: string; readPath?: string } {
  const type = part?.type
  if (type === "tool-Read") {
    const filePath = cleanInline(part?.input?.file_path || part?.input?.path || part?.input?._acpDetail)
    return {
      text: filePath ? `Read ${truncateMiddle(filePath)}` : "Read file",
      readPath: filePath || undefined,
    }
  }

  if (type === "tool-Grep") {
    const pattern = formatPattern(part?.input?.pattern || part?.input?.query || part?.input?._acpDetail)
    const include = cleanInline(part?.input?.include || part?.input?.path || "")
    if (pattern && include) return { text: `Searched for ${pattern} in ${truncateMiddle(include, 56)}` }
    if (pattern) return { text: `Searched for ${pattern}` }
    return { text: "Searched files" }
  }

  if (type === "tool-Glob") {
    const pattern = formatPattern(part?.input?.pattern || part?.input?.path || part?.input?._acpDetail)
    return { text: pattern ? `Listed ${pattern}` : "Listed files" }
  }

  if (type === "tool-WebSearch") {
    const query = formatPattern(part?.input?.query || part?.input?._acpDetail)
    return { text: query ? `Web searched ${query}` : "Web searched" }
  }

  if (type === "tool-WebFetch") {
    const url = cleanInline(part?.input?.url || part?.input?._acpDetail)
    return { text: url ? `Fetched ${truncateMiddle(url, 72)}` : "Fetched page" }
  }

  return { text: (part?.type || "Tool").replace("tool-", "") }
}

function formatSummary(fileCount: number, searchCount: number, listCount: number): string {
  const parts: string[] = []
  if (fileCount > 0) {
    parts.push(`${fileCount} ${fileCount === 1 ? "file" : "files"}`)
  }
  if (searchCount > 0) {
    parts.push(`${searchCount} ${searchCount === 1 ? "search" : "searches"}`)
  }
  if (listCount > 0) {
    parts.push(`${listCount} ${listCount === 1 ? "list" : "lists"}`)
  }
  return parts.join(", ")
}

export const AgentExploringGroup = memo(function AgentExploringGroup({
  parts,
  chatStatus: _chatStatus,
  isStreaming,
}: AgentExploringGroupProps) {
  const onOpenFile = useFileOpen()
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

  // Auto-scroll to bottom when streaming and new parts added
  useEffect(() => {
    if (isStreaming && isExpanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [parts.length, isStreaming, isExpanded])

  // Count files (Read, Grep, Glob) and searches (WebSearch, WebFetch)
  const fileCount = parts.filter((p) =>
    ["tool-Read"].includes(p.type),
  ).length
  const listCount = parts.filter((p) => ["tool-Glob"].includes(p.type)).length
  const searchCount = parts.filter((p) =>
    ["tool-Grep", "tool-WebSearch", "tool-WebFetch"].includes(p.type),
  ).length

  const subtitle = formatSummary(fileCount, searchCount, listCount)

  return (
    <div>
      {/* Header - clickable to toggle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="group flex items-start gap-1.5 py-0.5 px-2 cursor-pointer"
      >
        <div className="flex-1 min-w-0 flex items-center gap-1">
          <div className="text-xs flex items-center gap-1.5 min-w-0">
            <span className="font-medium whitespace-nowrap flex-shrink-0 text-muted-foreground">
              {isStreaming ? "Exploring" : "Explored"}
            </span>
            <span className="text-muted-foreground/60 whitespace-nowrap flex-shrink-0">
              {subtitle || `${parts.length} step${parts.length === 1 ? "" : "s"}`}
            </span>
            {/* Chevron right after text - rotates when expanded */}
            <ChevronRight
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground/60 transition-transform duration-200 ease-out",
                isExpanded && "rotate-90",
                !isExpanded && "opacity-0 group-hover:opacity-100",
              )}
            />
          </div>
        </div>
      </div>

      {/* Tools list - only show when expanded */}
      {isExpanded && (
        <div className="relative mt-1">
          {/* Top gradient fade when streaming and has many items */}
          <div
            className={cn(
              "absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none transition-opacity duration-200",
              isStreaming && parts.length > MAX_VISIBLE_TOOLS
                ? "opacity-100"
                : "opacity-0",
            )}
          />

          {/* Scrollable container - auto-scrolls to bottom when streaming */}
          <div
            ref={scrollRef}
            className={cn(
              "space-y-1",
              parts.length > MAX_VISIBLE_TOOLS &&
                "overflow-y-auto scrollbar-hide",
            )}
            style={
              parts.length > MAX_VISIBLE_TOOLS
                ? { maxHeight: `${MAX_VISIBLE_TOOLS * TOOL_HEIGHT_PX}px` }
                : undefined
            }
          >
            {parts.map((part, idx) => {
              const { text, readPath } = formatExplorationRow(part)
              const isPending =
                part.state !== "output-available" && part.state !== "output-error"
              const isError = part.state === "output-error"
              const canOpen = !!readPath && !!onOpenFile
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={canOpen ? () => onOpenFile(readPath!) : undefined}
                  disabled={!canOpen}
                  className={cn(
                    "w-full text-left flex items-center gap-2 px-2 py-[2px] rounded text-xs transition-colors",
                    canOpen
                      ? "hover:bg-muted/50 text-muted-foreground hover:text-foreground cursor-pointer"
                      : "text-muted-foreground cursor-default",
                  )}
                  title={canOpen && readPath ? readPath : undefined}
                >
                  {isPending ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground/70" />
                  ) : (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        isError ? "bg-red-500/80" : "bg-muted-foreground/50",
                      )}
                    />
                  )}
                  <span className="truncate">{text}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}, areExploringGroupPropsEqual)
