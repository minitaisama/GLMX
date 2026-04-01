"use client"

import { memo, useState, useCallback, useEffect } from "react"
import { useAtomValue } from "jotai"
import {
  GitBranchFilledIcon,
  FolderFilledIcon,
  GitPullRequestFilledIcon,
  ExternalLinkIcon,
} from "@/components/ui/icons"
import { Check, ChevronDown, Loader2 } from "lucide-react"
import { Kbd } from "@/components/ui/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { trpc } from "@/lib/trpc"
import { preferredEditorAtom } from "@/lib/atoms"
import { useResolvedHotkeyDisplay } from "@/lib/hotkeys"
import { APP_META } from "../../../../shared/external-apps"
import { EDITOR_ICONS } from "@/lib/editor-icons"

interface InfoSectionProps {
  chatId: string
  worktreePath: string | null
  isExpanded?: boolean
  /** Remote chat data for sandbox workspaces */
  remoteInfo?: {
    repository?: string
    branch?: string | null
    sandboxId?: string
  } | null
}

/** Property row component - Notion-style with icon, label, and value */
function PropertyRow({
  icon: Icon,
  label,
  value,
  title,
  onClick,
  copyable,
  tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  title?: string
  onClick?: () => void
  copyable?: boolean
  /** Tooltip to show on hover (for clickable items) */
  tooltip?: string
}) {
  const [showCopied, setShowCopied] = useState(false)

  const handleClick = useCallback(() => {
    if (copyable) {
      navigator.clipboard.writeText(value)
      setShowCopied(true)
      setTimeout(() => setShowCopied(false), 1500)
    } else if (onClick) {
      onClick()
    }
  }, [copyable, value, onClick])

  const isClickable = onClick || copyable

  const valueEl = isClickable ? (
    <button
      type="button"
      className="text-xs text-foreground cursor-pointer rounded px-1.5 py-0.5 -ml-1.5 truncate hover:bg-accent hover:text-accent-foreground transition-colors"
      title={!tooltip ? title : undefined}
      onClick={handleClick}
    >
      {value}
    </button>
  ) : (
    <span className="text-xs text-foreground truncate" title={!tooltip ? title : undefined}>
      {value}
    </span>
  )

  return (
    <div className="flex items-center min-h-[28px]">
      {/* Label column - fixed width */}
      <div className="flex items-center gap-1.5 w-[100px] flex-shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground truncate">{label}</span>
      </div>
      {/* Value column - flexible */}
      <div className="flex-1 min-w-0 pl-2 truncate">
        {copyable ? (
          <Tooltip open={showCopied ? true : undefined}>
            <TooltipTrigger asChild>
              {valueEl}
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {showCopied ? "Copied" : "Click to copy"}
            </TooltipContent>
          </Tooltip>
        ) : tooltip ? (
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              {valueEl}
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        ) : (
          valueEl
        )}
      </div>
    </div>
  )
}

/**
 * Info Section for Details Sidebar
 * Shows workspace info: branch, PR, path
 * Memoized to prevent re-renders when parent updates
 */
export const InfoSection = memo(function InfoSection({
  chatId,
  worktreePath,
  isExpanded = false,
  remoteInfo,
}: InfoSectionProps) {
  const [branchSwitchError, setBranchSwitchError] = useState<string | null>(null)
  // Extract folder name from path
  const folderName = worktreePath?.split("/").pop() || "Unknown"

  // Preferred editor from settings
  const preferredEditor = useAtomValue(preferredEditorAtom)
  const editorMeta = APP_META[preferredEditor]

  // Mutations
  const openInFinderMutation = trpc.external.openInFinder.useMutation()
  const openInAppMutation = trpc.external.openInApp.useMutation()
  const trpcUtils = trpc.useUtils()

  // Check if this is a remote sandbox chat (no local worktree)
  const isRemoteChat = !worktreePath && !!remoteInfo

  // Fetch branch data directly (only for local chats)
  const { data: branchData, isLoading: isBranchLoading, error: branchQueryError } = trpc.changes.getBranches.useQuery(
    { worktreePath: worktreePath || "" },
    { enabled: !!worktreePath, retry: false, refetchOnWindowFocus: false }
  )
  const checkoutMutation = trpc.changes.checkout.useMutation({
    onSuccess: () => {
      setBranchSwitchError(null)
      void trpcUtils.changes.getBranches.invalidate({ worktreePath: worktreePath || "" })
    },
    onError: (error) => {
      setBranchSwitchError(error.message || "Failed to switch branch")
    },
  })

  // Get PR status for current branch (only for local chats)
  const { data: prStatus } = trpc.chats.getPrStatus.useQuery(
    { chatId },
    {
      refetchInterval: 30000, // Poll every 30 seconds
      enabled: !!chatId && !!worktreePath, // Only enable for local chats
    }
  )

  // For local chats: use fetched branch data
  // For remote chats: use remoteInfo from props
  const branchName = isRemoteChat ? remoteInfo?.branch : branchData?.current
  const pr = prStatus?.pr
  const branchLoadError = !isRemoteChat && !!worktreePath && !isBranchLoading && !branchData
  const branchErrorMessage = branchQueryError?.message || ""
  const branchActionDisabledReason = !worktreePath
    ? "This chat is not attached to a local git workspace."
    : branchLoadError
      ? (branchErrorMessage.includes("not a git repository") || branchErrorMessage.includes("not attached")
        ? "This chat is not attached to a local git workspace."
        : "Branch actions are unavailable for this workspace.")
      : null

  // Extract repo name from repository URL (e.g., "owner/repo" from "github.com/owner/repo")
  const repositoryName = remoteInfo?.repository
    ? remoteInfo.repository.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "")
    : null

  const handleOpenFolder = () => {
    if (worktreePath) {
      openInFinderMutation.mutate(worktreePath)
    }
  }

  const isWorktree = !!worktreePath && worktreePath.includes(".21st/worktrees")
  const openInEditorHotkey = useResolvedHotkeyDisplay("open-in-editor")

  const handleOpenInEditor = useCallback(() => {
    if (worktreePath) {
      openInAppMutation.mutate({ path: worktreePath, app: preferredEditor })
    }
  }, [worktreePath, preferredEditor, openInAppMutation])

  // Listen for ⌘O hotkey event
  useEffect(() => {
    if (!isWorktree) return
    const handler = () => handleOpenInEditor()
    window.addEventListener("open-in-editor", handler)
    return () => window.removeEventListener("open-in-editor", handler)
  }, [isWorktree, handleOpenInEditor])

  const handleOpenPr = () => {
    if (pr?.url) {
      window.desktopApi.openExternal(pr.url)
    }
  }

  const handleOpenRepository = () => {
    if (remoteInfo?.repository) {
      const repoUrl = remoteInfo.repository.startsWith("http")
        ? remoteInfo.repository
        : `https://github.com/${remoteInfo.repository}`
      window.desktopApi.openExternal(repoUrl)
    }
  }

  const handleSwitchBranch = (targetBranch: string) => {
    if (!worktreePath || checkoutMutation.isPending) return
    if (targetBranch === branchData?.current) return
    setBranchSwitchError(null)
    checkoutMutation.mutate({ worktreePath, branch: targetBranch })
  }

  const handleOpenSandbox = () => {
    if (remoteInfo?.sandboxId) {
      const sandboxUrl = `https://3003-${remoteInfo.sandboxId}.e2b.app`
      window.desktopApi.openExternal(sandboxUrl)
    }
  }

  // Show loading state while branch data is loading (only for local chats)
  if (!isRemoteChat && isBranchLoading) {
    return (
      <div className="px-2 py-1.5 flex flex-col gap-0.5">
        <div className="flex items-center min-h-[28px]">
          <div className="flex items-center gap-1.5 w-[100px] flex-shrink-0">
            <div className="h-3.5 w-3.5 rounded bg-muted animate-pulse" />
            <div className="h-3 w-12 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex-1 min-w-0 pl-2">
            <div className="h-3 w-32 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="flex items-center min-h-[28px]">
          <div className="flex items-center gap-1.5 w-[100px] flex-shrink-0">
            <div className="h-3.5 w-3.5 rounded bg-muted animate-pulse" />
            <div className="h-3 w-8 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex-1 min-w-0 pl-2">
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  const hasContent = branchName || worktreePath || repositoryName || remoteInfo?.sandboxId

  if (!hasContent) {
    return (
      <div className="px-2 py-2">
        <div className="text-xs text-muted-foreground">
          No workspace info available
        </div>
      </div>
    )
  }

  return (
    <div className="px-2 py-1.5 flex flex-col gap-0.5">
      {/* Repository - only for remote chats */}
      {repositoryName && (
        <PropertyRow
          icon={FolderFilledIcon}
          label="Repository"
          value={repositoryName}
          title={remoteInfo?.repository}
          onClick={handleOpenRepository}
          tooltip="Open in GitHub"
        />
      )}
      {/* Branch - for both local and remote */}
      {isRemoteChat && branchName && (
        <PropertyRow icon={GitBranchFilledIcon} label="Branch" value={branchName} copyable />
      )}
      {!isRemoteChat && (
        <div className="flex flex-col">
          <div className="flex items-center min-h-[28px]">
            <div className="flex items-center gap-1.5 w-[100px] flex-shrink-0">
              <GitBranchFilledIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">Branch</span>
            </div>
            <div className="flex-1 min-w-0 pl-2 truncate">
              {branchActionDisabledReason ? (
                <Tooltip delayDuration={400}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled
                      className="text-xs text-muted-foreground/70 cursor-not-allowed rounded px-1.5 py-0.5 -ml-1.5"
                    >
                      Unavailable
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {branchActionDisabledReason}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={checkoutMutation.isPending}
                      className="inline-flex items-center gap-1 text-xs text-foreground cursor-pointer rounded px-1.5 py-0.5 -ml-1.5 hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-60 disabled:cursor-wait"
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      <span className="truncate max-w-[170px]">
                        {branchName || "Select branch"}
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
                    {(branchData?.local || []).map((branch) => {
                      const isCurrent = branch.branch === branchData?.current
                      return (
                        <DropdownMenuItem
                          key={branch.branch}
                          onClick={() => handleSwitchBranch(branch.branch)}
                          disabled={checkoutMutation.isPending}
                          className="text-xs"
                        >
                          <span className="truncate flex-1">{branch.branch}</span>
                          {isCurrent ? <Check className="h-3 w-3 text-foreground/80" /> : null}
                        </DropdownMenuItem>
                      )
                    })}
                    {(branchData?.local || []).length === 0 && (
                      <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                        No local branches found
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          {branchActionDisabledReason && (
            <div className="pl-[108px] text-[10px] text-amber-500/90">
              This chat is not attached to a local git workspace.
            </div>
          )}
          {branchSwitchError && (
            <div className="pl-[108px] text-[10px] text-red-400">
              {branchSwitchError}
            </div>
          )}
        </div>
      )}
      {/* PR - only for local chats */}
      {pr && (
        <PropertyRow
          icon={GitPullRequestFilledIcon}
          label="Pull Request"
          value={`#${pr.number}`}
          title={pr.title}
          onClick={handleOpenPr}
          tooltip="Open in GitHub"
        />
      )}
      {/* Path - only for local chats */}
      {worktreePath && (
        <PropertyRow
          icon={FolderFilledIcon}
          label="Path"
          value={folderName}
          title={worktreePath}
          onClick={handleOpenFolder}
          tooltip="Open in Finder"
        />
      )}
      {/* Open in Editor - only for actual git worktrees (under ~/.21st/worktrees/) */}
      {isWorktree && (
        <div className="flex items-center min-h-[28px]">
          <div className="flex items-center gap-1.5 w-[100px] flex-shrink-0">
            <ExternalLinkIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">Open in</span>
          </div>
          <div className="flex-1 min-w-0 pl-2">
            <Tooltip delayDuration={500}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleOpenInEditor}
                  className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer rounded px-1.5 py-0.5 -ml-1.5 hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {EDITOR_ICONS[preferredEditor] && (
                    <img
                      src={EDITOR_ICONS[preferredEditor]}
                      alt=""
                      className="h-3.5 w-3.5 flex-shrink-0"
                    />
                  )}
                  {editorMeta.label}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Open in {editorMeta.label}
                {openInEditorHotkey && <Kbd className="normal-case font-sans">{openInEditorHotkey}</Kbd>}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  )
})
