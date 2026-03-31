"use client"

import { useState, useRef, useEffect } from "react"
import {
  ChevronDown,
  Send,
  Paperclip,
  Terminal,
  GitBranch,
  Wrench,
  Copy,
  RotateCcw,
  ChevronUp,
  CheckCircle2,
  Circle,
  Loader2,
  Lightbulb,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  thought?: string
  toolCalls?: ToolCall[]
}

interface ToolCall {
  id: string
  name: string
  status: "pending" | "running" | "done" | "error"
  result?: string
  duration?: string
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "m1",
    role: "user",
    content: "Refactor the auth middleware to use httpOnly cookies instead of localStorage tokens.",
    timestamp: "2:14 PM",
  },
  {
    id: "m2",
    role: "assistant",
    content: "I'll refactor the auth middleware to use httpOnly cookies. Here's what I did:",
    timestamp: "2:14 PM",
    thought: "The user wants to move from client-side token storage to secure httpOnly cookies. I need to scan for all localStorage auth references, then update the middleware and any components that read from localStorage.",
    toolCalls: [
      { id: "t1", name: "search_files('localStorage')", status: "done", result: "Found 7 matches", duration: "342ms" },
      { id: "t2", name: "read_file(src/middleware/auth.ts)", status: "done", result: "142 lines", duration: "18ms" },
      { id: "t3", name: "edit_file(src/middleware/auth.ts)", status: "done", result: "Patched 3 functions", duration: "124ms" },
    ],
  },
]

interface WorkspaceProps {
  onOpenModelSelector: () => void
  selectedModel: string
}

export function Workspace({ onOpenModelSelector, selectedModel }: WorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState("")
  const [activeTab, setActiveTab] = useState<"chat" | "diff" | "terminal">("chat")
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    const newMsg: Message = {
      id: `m${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }
    setMessages((prev) => [...prev, newMsg])
    setInput("")
  }

  const toggleTools = (msgId: string) => {
    setExpandedTools((prev) => ({ ...prev, [msgId]: !prev[msgId] }))
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 h-13 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            Migrate JWT to sessions
          </span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="w-3.5 h-3.5" />
            <span className="font-mono">refactor-auth</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenModelSelector}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-secondary text-foreground text-xs transition-colors hover:bg-accent"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="font-mono">{selectedModel}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-0.5 rounded-md p-0.5 border border-border bg-secondary">
            {(["chat", "diff", "terminal"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs transition-colors capitalize",
                  activeTab === tab
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Chat area */}
      {activeTab === "chat" && (
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
              {/* Avatar */}
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 mt-0.5 font-mono text-xs font-bold bg-card border border-border text-primary">
                  G
                </div>
              )}

              <div className={cn("max-w-[70%] space-y-2.5", msg.role === "user" ? "items-end flex flex-col" : "items-start flex flex-col")}>
                {/* Thought block */}
                {msg.thought && (
                  <div className="rounded-lg px-3.5 py-2.5 border-l-3 border-l-muted-foreground bg-card text-secondary-foreground italic text-sm leading-relaxed max-w-full">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Thought
                      </span>
                    </div>
                    {msg.thought}
                  </div>
                )}

                {/* Tool calls */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="rounded-lg border-l-3 border-l-[var(--accent-orange)] overflow-hidden w-full bg-input">
                    <button
                      onClick={() => toggleTools(msg.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors",
                        expandedTools[msg.id] ? "border-b border-border" : "hover:bg-card"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Wrench className="w-3.5 h-3.5 flex-shrink-0 text-[var(--accent-orange)]" />
                        <span className="font-semibold text-[var(--accent-orange)]">
                          {msg.toolCalls.length} step{msg.toolCalls.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {expandedTools[msg.id] ? (
                        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>

                    {expandedTools[msg.id] && (
                      <div className="border-t border-border">
                        {msg.toolCalls.map((tool, i) => (
                          <div
                            key={tool.id}
                            className={cn(
                              "flex items-center justify-between px-3.5 py-2.5 text-xs font-mono",
                              i < msg.toolCalls!.length - 1 ? "border-b border-border" : ""
                            )}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {tool.status === "done" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-[var(--accent-green)]" />
                              ) : tool.status === "running" ? (
                                <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin text-primary" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                              )}
                              <span className="text-foreground truncate">
                                {tool.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              {tool.duration && (
                                <span className="text-[11px] text-muted-foreground">
                                  {tool.duration}
                                </span>
                              )}
                              {tool.result && (
                                <span className="text-[11px] text-muted-foreground">
                                  {tool.result}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Main message bubble */}
                <div
                  className={cn(
                    "rounded-lg px-4 py-3 text-sm leading-relaxed border-l-3",
                    msg.role === "user"
                      ? "w-full bg-[var(--user-bubble)] border-l-[var(--user-border)] text-foreground"
                      : "bg-card border-l-[var(--agent-border)] text-foreground"
                  )}
                >
                  {msg.content}
                </div>

                {/* Actions (agent only) */}
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[11px] text-muted-foreground">
                      {msg.timestamp}
                    </span>
                    <button className="text-muted-foreground hover:text-primary transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button className="text-muted-foreground hover:text-primary transition-colors">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {activeTab === "diff" && <DiffView />}
      {activeTab === "terminal" && <TerminalView />}

      {/* Input bar */}
      <div className="px-6 pb-6 pt-4 border-t border-border">
        <div className="rounded-lg overflow-hidden border border-border bg-input focus-within:ring-1 focus-within:ring-ring transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask GLMX anything... ⌘↵"
            rows={3}
            className="w-full bg-transparent px-4 pt-3.5 pb-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed"
          />
          <div className="flex items-center justify-between px-3.5 pb-3">
            <div className="flex items-center gap-1">
              {[Paperclip, Terminal].map((Icon, i) => (
                <button
                  key={i}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                input.trim()
                  ? "bg-primary text-primary-foreground cursor-pointer"
                  : "bg-accent text-muted-foreground cursor-not-allowed opacity-50"
              )}
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          GLM-4-Plus · context 128k · ZAI
        </p>
      </div>
    </div>
  )
}

function DiffView() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-input">
          <span className="text-xs font-mono text-muted-foreground">
            src/middleware/auth.ts
          </span>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-[var(--accent-green)]">+18</span>
            <span className="text-destructive">-22</span>
          </div>
        </div>
        <div className="p-4 font-mono text-xs leading-6 overflow-x-auto bg-input">
          {DIFF_LINES.map((line, i) => (
            <div
              key={i}
              className={cn(
                "px-2 -mx-2 rounded",
                line.type === "add" && "bg-[var(--accent-green)]/10 text-[var(--accent-green)]",
                line.type === "remove" && "bg-destructive/10 text-destructive",
                line.type === "context" && "text-muted-foreground"
              )}
            >
              <span className="select-none mr-4 text-[10px] opacity-40 w-6 inline-block text-right">
                {line.no}
              </span>
              <span className="select-none mr-2 opacity-60">
                {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
              </span>
              {line.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TerminalView() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="border border-border rounded-lg overflow-hidden h-full min-h-64">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-input">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <span className="text-xs font-mono ml-2 text-muted-foreground">
            zsh — refactor-auth
          </span>
        </div>
        <div className="p-4 font-mono text-xs leading-6 bg-input text-[var(--accent-green)]">
          <div>
            <span className="text-muted-foreground">~/refactor-auth</span> <span className="text-primary">$</span> npx tsc --noEmit
          </div>
          <div className="text-muted-foreground mt-1">
            Running type check...
          </div>
          <div className="text-[var(--accent-green)]">Found 0 errors. ✓</div>
          <div className="mt-2">
            <span className="text-muted-foreground">~/refactor-auth</span> <span className="text-primary">$</span> pnpm test
          </div>
          <div className="text-muted-foreground">Running 14 tests...</div>
          <div className="text-[var(--accent-green)]">14 passed (0 failed)</div>
          <div className="mt-2 flex items-center gap-1">
            <span className="text-muted-foreground">~/refactor-auth</span>
            <span className="text-primary"> $</span>
            <span className="animate-pulse ml-1 text-foreground">
              ▊
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const DIFF_LINES = [
  { no: "1", type: "context", content: "import { NextRequest, NextResponse } from 'next/server'" },
  { no: "2", type: "context", content: "" },
  { no: "3", type: "remove", content: "const token = localStorage.getItem('auth_token')" },
  { no: "3", type: "add", content: "const token = request.cookies.get('auth_token')?.value" },
  { no: "4", type: "context", content: "" },
  { no: "5", type: "remove", content: "if (!token) return redirect('/login')" },
  { no: "5", type: "add", content: "if (!token) {" },
  { no: "6", type: "add", content: "  return NextResponse.redirect(new URL('/login', request.url))" },
  { no: "7", type: "add", content: "}" },
  { no: "8", type: "context", content: "" },
  { no: "9", type: "context", content: "const payload = await verifyJWT(token)" },
]
