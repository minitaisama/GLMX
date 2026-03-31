let currentUserId: string | null = null

export function setOptOut(_optedOut: boolean) {}
export function setSubscriptionPlan(_plan: string) {}
export function setConnectionMethod(_method: string) {}
export function initAnalytics() {}
export function capture(_eventName: string, _properties?: Record<string, any>) {}
export function identify(userId: string, _traits?: Record<string, any>) {
  currentUserId = userId
}
export function getCurrentUserId(): string | null {
  return currentUserId
}
export function reset() {
  currentUserId = null
}
export async function shutdown() {}
export function trackAppOpened() {}

/**
 * Track successful authentication
 */
export function trackAuthCompleted(userId: string, email?: string) {
  identify(userId, email ? { email } : undefined)
  capture("auth_completed", {
    user_id: userId,
  })
}

/**
 * Track project opened
 */
export function trackProjectOpened(project: {
  id: string
  hasGitRemote: boolean
}) {
  capture("project_opened", {
    project_id: project.id,
    has_git_remote: project.hasGitRemote,
  })
}

/**
 * Track workspace/chat created
 */
export function trackWorkspaceCreated(workspace: {
  id: string
  projectId: string
  useWorktree: boolean
  repository?: string
}) {
  capture("workspace_created", {
    workspace_id: workspace.id,
    project_id: workspace.projectId,
    use_worktree: workspace.useWorktree,
    repository: workspace.repository,
  })
}

/**
 * Track workspace archived
 */
export function trackWorkspaceArchived(workspaceId: string) {
  capture("workspace_archived", {
    workspace_id: workspaceId,
  })
}

/**
 * Track workspace deleted
 */
export function trackWorkspaceDeleted(workspaceId: string) {
  capture("workspace_deleted", {
    workspace_id: workspaceId,
  })
}

/**
 * Track message sent
 */
export function trackMessageSent(data: {
  workspaceId: string
  subChatId?: string
  mode: "plan" | "agent"
}) {
  capture("message_sent", {
    workspace_id: data.workspaceId,
    sub_chat_id: data.subChatId,
    mode: data.mode,
  })
}

/**
 * Track PR created
 */
export function trackPRCreated(data: {
  workspaceId: string
  prNumber: number
  repository?: string
  mode?: "worktree" | "local"
}) {
  capture("pr_created", {
    workspace_id: data.workspaceId,
    pr_number: data.prNumber,
    repository: data.repository,
    mode: data.mode,
  })
}

/**
 * Track commit created
 */
export function trackCommitCreated(data: {
  workspaceId: string
  filesChanged: number
  mode: "worktree" | "local"
}) {
  capture("commit_created", {
    workspace_id: data.workspaceId,
    files_changed: data.filesChanged,
    mode: data.mode,
  })
}

/**
 * Track sub-chat created
 */
export function trackSubChatCreated(data: {
  workspaceId: string
  subChatId: string
}) {
  capture("sub_chat_created", {
    workspace_id: data.workspaceId,
    sub_chat_id: data.subChatId,
  })
}
