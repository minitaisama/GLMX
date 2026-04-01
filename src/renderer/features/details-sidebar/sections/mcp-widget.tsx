"use client"

import { useAtomValue, useSetAtom } from "jotai"
import { ChevronDown } from "lucide-react"
import { memo, useMemo, useState } from "react"
import { OriginalMCPIcon } from "../../../components/ui/icons"
import { sessionInfoAtom, type MCPServer } from "../../../lib/atoms"
import { cn } from "../../../lib/utils"
import { pendingMentionAtom } from "../../agents/atoms"
import { trpc } from "../../../lib/trpc"
import { Button } from "../../../components/ui/button"

function formatToolName(toolName: string): string {
  return toolName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Get the best icon URL for an MCP server.
 * Prefers SVG, then picks the largest raster icon.
 * Returns null if no icons available.
 */
function getServerIconUrl(server: MCPServer): string | null {
  const icons = server.serverInfo?.icons
  if (!icons || icons.length === 0) return null

  // Prefer SVG
  const svg = icons.find((i) => i.mimeType === "image/svg+xml")
  if (svg) return svg.src

  // Otherwise pick the one with the largest size, or first available
  let best = icons[0]
  let bestSize = 0
  for (const icon of icons) {
    if (icon.sizes?.length) {
      const size = parseInt(icon.sizes[0], 10) || 0
      if (size > bestSize) {
        bestSize = size
        best = icon
      }
    }
  }
  return best.src
}

function ServerIcon({ server }: { server: MCPServer }) {
  const iconUrl = getServerIconUrl(server)
  const [imgError, setImgError] = useState(false)

  if (iconUrl && !imgError) {
    return (
      <img
        src={iconUrl}
        alt=""
        className="h-3.5 w-3.5 shrink-0 rounded-sm object-contain"
        onError={() => setImgError(true)}
      />
    )
  }

  return <OriginalMCPIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
}

interface McpWidgetProps {
  projectPath?: string | null
}

function statusTone(status: string) {
  if (status === "connected") return "text-emerald-400"
  if (status === "needs-auth") return "text-amber-400"
  if (status === "failed") return "text-red-400"
  if (status === "pending") return "text-muted-foreground"
  return "text-muted-foreground"
}

export const McpWidget = memo(function McpWidget({ projectPath }: McpWidgetProps) {
  const sessionInfo = useAtomValue(sessionInfoAtom)
  const setPendingMention = useSetAtom(pendingMentionAtom)
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set())
  const [testedAt, setTestedAt] = useState<string | null>(null)

  const normalizedProjectPath = projectPath?.trim() || ""

  const { data: configuredData } = trpc.claude.getMcpConfig.useQuery(
    { projectPath: normalizedProjectPath },
    {
      enabled: !!normalizedProjectPath,
      retry: false,
      refetchOnWindowFocus: false,
    },
  )

  const testMcpMutation = trpc.claude.testMcpServers.useMutation({
    onSuccess: (data) => {
      setTestedAt(data.testedAt)
    },
  })

  const toolsByServer = useMemo(() => {
    if (!sessionInfo?.tools || !sessionInfo?.mcpServers) return new Map<string, string[]>()
    const map = new Map<string, string[]>()
    for (const server of sessionInfo.mcpServers) {
      map.set(server.name, [])
    }
    for (const tool of sessionInfo.tools) {
      if (!tool.startsWith("mcp__")) continue
      const parts = tool.split("__")
      if (parts.length < 3) continue
      const serverName = parts[1]
      const toolName = parts.slice(2).join("__")
      const serverTools = map.get(serverName) || []
      serverTools.push(toolName)
      map.set(serverName, serverTools)
    }
    return map
  }, [sessionInfo?.tools, sessionInfo?.mcpServers])

  const configuredMap = useMemo(() => {
    const map = new Map<
      string,
      { status: string }
    >()
    for (const server of configuredData?.mcpServers || []) {
      map.set(server.name, { status: server.status })
    }
    return map
  }, [configuredData?.mcpServers])

  const liveSessionMap = useMemo(() => {
    const map = new Map<string, MCPServer["status"]>()
    for (const server of sessionInfo?.mcpServers || []) {
      map.set(server.name, server.status)
    }
    return map
  }, [sessionInfo?.mcpServers])

  const testedMap = useMemo(() => {
    const map = new Map<
      string,
      { status: string; toolCount: number; error?: string }
    >()
    for (const server of testMcpMutation.data?.servers || []) {
      map.set(server.name, server)
    }
    return map
  }, [testMcpMutation.data?.servers])

  const allServerNames = useMemo(() => {
    const names = new Set<string>()
    for (const name of configuredMap.keys()) names.add(name)
    for (const name of liveSessionMap.keys()) names.add(name)
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [configuredMap, liveSessionMap])

  if (allServerNames.length === 0) {
    return (
      <div className="px-2 py-2">
        <div className="text-xs text-muted-foreground">
          No MCP servers configured
        </div>
      </div>
    )
  }

  const toggleServer = (name: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleToolClick = (serverName: string, toolName: string, fullToolId: string) => {
    setPendingMention({
      id: `tool:${fullToolId}`,
      label: formatToolName(toolName),
      path: fullToolId,
      repository: "",
      truncatedPath: serverName,
      type: "tool",
      mcpServer: serverName,
    })
  }

  return (
    <div className="px-2 py-1.5 flex flex-col gap-0.5">
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-[11px] text-muted-foreground">
          Configured vs Live
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!normalizedProjectPath || testMcpMutation.isPending}
          className="h-5 px-1.5 text-[10px]"
          onClick={() => {
            if (!normalizedProjectPath) return
            testMcpMutation.mutate({ projectPath: normalizedProjectPath })
          }}
        >
          {testMcpMutation.isPending ? "Testing..." : "Test MCP"}
        </Button>
      </div>
      {!normalizedProjectPath && (
        <div className="px-1 pb-1 text-[10px] text-amber-500/90">
          Live MCP test requires a local git workspace path.
        </div>
      )}
      {testedAt && (
        <div className="px-1 pb-1 text-[10px] text-muted-foreground">
          Last test: {new Date(testedAt).toLocaleTimeString()}
        </div>
      )}
      {allServerNames.map((serverName) => {
        const server = sessionInfo?.mcpServers?.find((s) => s.name === serverName) || {
          name: serverName,
          status: "pending" as const,
        }
        const tools = toolsByServer.get(server.name) || []
        const isExpanded = expandedServers.has(server.name)
        const hasTools = tools.length > 0
        const configuredStatus = configuredMap.get(server.name)?.status || "not-configured"
        const liveStatus = testedMap.get(server.name)?.status || liveSessionMap.get(server.name) || "unknown"
        const liveToolCount = testedMap.get(server.name)?.toolCount
        const liveError = testedMap.get(server.name)?.error

        return (
          <div key={server.name}>
            {/* Server row */}
            <button
              onClick={() => hasTools && toggleServer(server.name)}
              className={cn(
                "w-full flex items-center gap-1.5 min-h-[28px] rounded px-1.5 py-0.5 -ml-0.5 transition-colors",
                hasTools
                  ? "hover:bg-accent cursor-pointer"
                  : "cursor-default",
              )}
            >
              <ServerIcon server={server} />
              <span className="text-xs text-foreground truncate flex-1 text-left">
                {server.name}
              </span>
              {hasTools && (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {tools.length}
                </span>
              )}
              {hasTools && (
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-muted-foreground/50 shrink-0 transition-transform duration-150",
                    !isExpanded && "-rotate-90",
                  )}
                />
              )}
            </button>
            <div className="ml-[18px] pb-1 flex flex-wrap items-center gap-2 text-[10px]">
              <span className={cn("font-medium", statusTone(configuredStatus))}>
                Configured: {configuredStatus}
              </span>
              <span className={cn("font-medium", statusTone(liveStatus))}>
                Live: {liveStatus}
              </span>
              {typeof liveToolCount === "number" && (
                <span className="text-muted-foreground">tools: {liveToolCount}</span>
              )}
            </div>
            {liveError && (
              <div className="ml-[18px] pb-1 text-[10px] text-red-400 truncate">
                {liveError}
              </div>
            )}

            {/* Tools list */}
            {isExpanded && hasTools && (
              <div className="ml-[18px] py-0.5 flex flex-col gap-px">
                {tools.map((tool) => {
                  const fullToolId = `mcp__${server.name}__${tool}`
                  return (
                    <button
                      key={tool}
                      onClick={() => handleToolClick(server.name, tool, fullToolId)}
                      className="group/tool w-full flex items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground py-1 px-1.5 rounded hover:bg-accent transition-colors truncate"
                    >
                      <span className="truncate flex-1">{formatToolName(tool)}</span>
                      <span className="text-[10px] text-muted-foreground/0 group-hover/tool:text-muted-foreground/50 transition-colors shrink-0">
                        @
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})
