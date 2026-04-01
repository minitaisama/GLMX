"use client"

import { useState } from "react"
import {
  Plus,
  Search,
  MessageSquare,
  Settings,
  FolderOpen,
  ChevronRight,
  Zap,
  Terminal,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Chat {
  id: string
  title: string
  timestamp: string
  active?: boolean
}

interface Project {
  id: string
  name: string
  chats: Chat[]
}

const PROJECTS: Project[] = [
  {
    id: "p1",
    name: "refactor-auth",
    chats: [
      { id: "c1", title: "Migrate JWT to sessions", timestamp: "2m ago", active: true },
      { id: "c2", title: "Fix refresh token race", timestamp: "1h ago" },
    ],
  },
  {
    id: "p2",
    name: "api-gateway",
    chats: [
      { id: "c3", title: "Rate limiting middleware", timestamp: "3h ago" },
      { id: "c4", title: "OpenAPI schema gen", timestamp: "Yesterday" },
    ],
  },
  {
    id: "p3",
    name: "data-pipeline",
    chats: [
      { id: "c5", title: "Batch ingestion fix", timestamp: "2d ago" },
    ],
  },
]

interface SidebarProps {
  onOpenSettings: () => void
  onSelectChat: (chatId: string) => void
  activeChatId: string
}

export function Sidebar({ onOpenSettings, onSelectChat, activeChatId }: SidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(["p1", "p2"]))
  const [searchQuery, setSearchQuery] = useState("")

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredProjects = PROJECTS.map((p) => ({
    ...p,
    chats: p.chats.filter((c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((p) => p.chats.length > 0 || searchQuery === "")

  return (
    <aside className="w-60 bg-sidebar border-r border-sidebar-border flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-foreground font-semibold text-sm tracking-tight">GLMX</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-muted border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono bg-surface-3 px-1 py-0.5 rounded">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* New chat button */}
      <div className="px-3 py-2.5 border-b border-sidebar-border">
        <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
          <Plus className="w-3.5 h-3.5" />
          New chat
        </button>
      </div>

      {/* Projects & chats */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {filteredProjects.map((project) => (
          <div key={project.id} className="mb-1">
            <button
              onClick={() => toggleProject(project.id)}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors group"
            >
              <ChevronRight
                className={cn(
                  "w-3 h-3 transition-transform shrink-0",
                  expandedProjects.has(project.id) && "rotate-90"
                )}
              />
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate font-mono">{project.name}</span>
            </button>

            {expandedProjects.has(project.id) && (
              <div className="ml-4 mt-0.5 space-y-0.5">
                {project.chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => onSelectChat(chat.id)}
                    className={cn(
                      "w-full flex items-start gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left",
                      activeChatId === chat.id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate leading-tight">{chat.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{chat.timestamp}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-2 py-2 space-y-0.5">
        <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
          <Terminal className="w-3.5 h-3.5" />
          Terminal
        </button>
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
      </div>
    </aside>
  )
}
