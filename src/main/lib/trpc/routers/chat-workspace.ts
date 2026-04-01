import { existsSync } from "node:fs"
import { eq } from "drizzle-orm"
import { chats, getDatabase, projects } from "../../db"

type ResolvedWorkspace = {
  cwd: string
  projectPath?: string
}

function normalizePath(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function resolveWorkspaceForChat(
  chatId: string,
  requestedCwd: string,
  requestedProjectPath?: string,
): ResolvedWorkspace | null {
  const db = getDatabase()
  const chat = db
    .select({
      id: chats.id,
      worktreePath: chats.worktreePath,
      projectId: chats.projectId,
    })
    .from(chats)
    .where(eq(chats.id, chatId))
    .get()

  if (!chat) {
    return null
  }

  const project = db
    .select({
      id: projects.id,
      path: projects.path,
    })
    .from(projects)
    .where(eq(projects.id, chat.projectId))
    .get()

  const normalizedRequestedCwd = normalizePath(requestedCwd)
  const normalizedRequestedProjectPath = normalizePath(requestedProjectPath)
  const normalizedChatWorktree = normalizePath(chat.worktreePath)
  const normalizedProjectPath = normalizePath(project?.path)

  const candidates = [
    normalizedRequestedCwd,
    normalizedChatWorktree,
    normalizedRequestedProjectPath,
    normalizedProjectPath,
  ].filter((value): value is string => Boolean(value))

  const resolvedCwd = candidates.find((candidate) => existsSync(candidate))

  if (!resolvedCwd) {
    return null
  }

  if (normalizedChatWorktree !== resolvedCwd) {
    db.update(chats)
      .set({
        worktreePath: resolvedCwd,
        updatedAt: new Date(),
      })
      .where(eq(chats.id, chat.id))
      .run()
  }

  if (normalizedProjectPath && normalizedProjectPath !== resolvedCwd) {
    return {
      cwd: resolvedCwd,
      projectPath: normalizedProjectPath,
    }
  }

  if (
    normalizedRequestedProjectPath &&
    normalizedRequestedProjectPath !== resolvedCwd
  ) {
    return {
      cwd: resolvedCwd,
      projectPath: normalizedRequestedProjectPath,
    }
  }

  if (normalizedProjectPath && existsSync(normalizedProjectPath)) {
    return {
      cwd: resolvedCwd,
      projectPath: normalizedProjectPath,
    }
  }

  return {
    cwd: resolvedCwd,
  }
}

export function trimProjectRecordPaths(): void {
  const db = getDatabase()
  const allProjects = db.select().from(projects).all()

  for (const project of allProjects) {
    const trimmedName = project.name.trim()
    const trimmedPath = project.path.trim()
    if (trimmedName === project.name && trimmedPath === project.path) {
      continue
    }

    const conflictingProject = db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.path, trimmedPath))
      .get()

    db.update(projects)
      .set({
        name: trimmedName,
        path:
          conflictingProject && conflictingProject.id !== project.id
            ? project.path
            : trimmedPath,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, project.id))
      .run()
  }
}
