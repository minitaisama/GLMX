import { z } from "zod"
import { router, publicProcedure } from "../index"
import { chats, getDatabase, projects } from "../../db"
import { desc, eq, inArray } from "drizzle-orm"
import { dialog, BrowserWindow, app } from "electron"
import { basename, join } from "path"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { existsSync } from "node:fs"
import { mkdir, copyFile, unlink } from "node:fs/promises"
import { extname } from "node:path"
import { getGitRemoteInfo } from "../../git"
import { trackProjectOpened } from "../../analytics"
import { getLaunchDirectory } from "../../cli"
import { trimProjectRecordPaths } from "./chat-workspace"

const execAsync = promisify(exec)

function withPathExists<T extends { path: string }>(project: T) {
  return {
    ...project,
    pathExists: existsSync(project.path.trim()),
  }
}

export const projectsRouter = router({
  /**
   * Get launch directory from CLI args (consumed once)
   * Based on PR #16 by @caffeinum
   */
  getLaunchDirectory: publicProcedure.query(() => {
    return getLaunchDirectory()
  }),

  /**
   * List all projects
   */
  list: publicProcedure.query(() => {
    trimProjectRecordPaths()
    const db = getDatabase()
    return db
      .select()
      .from(projects)
      .orderBy(desc(projects.updatedAt))
      .all()
      .map(withPathExists)
  }),

  /**
   * Get a single project by ID
   */
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      trimProjectRecordPaths()
      const db = getDatabase()
      const project = db.select().from(projects).where(eq(projects.id, input.id)).get()
      return project ? withPathExists(project) : null
    }),

  /**
   * Open folder picker and create project
   */
  openFolder: publicProcedure.mutation(async ({ ctx }) => {
    const window = ctx.getWindow?.() ?? BrowserWindow.getFocusedWindow()

    if (!window) {
      console.error("[Projects] No window available for folder dialog")
      return null
    }

    // Ensure window is focused before showing dialog (fixes first-launch timing issue on macOS)
    if (!window.isFocused()) {
      console.log("[Projects] Window not focused, focusing before dialog...")
      window.focus()
      // Small delay to ensure focus is applied by the OS
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    const result = await dialog.showOpenDialog(window, {
      properties: ["openDirectory", "createDirectory"],
      title: "Select Project Folder",
      buttonLabel: "Open Project",
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

      const folderPath = result.filePaths[0]!.trim()
      const folderName = basename(folderPath).trim()

    // Get git remote info
    const gitInfo = await getGitRemoteInfo(folderPath)

    const db = getDatabase()

    // Check if project already exists
    const existing = db
      .select()
      .from(projects)
      .where(eq(projects.path, folderPath))
      .get()

    if (existing) {
      // Update the updatedAt timestamp and git info (in case remote changed)
      const updatedProject = db
        .update(projects)
        .set({
          updatedAt: new Date(),
          gitRemoteUrl: gitInfo.remoteUrl,
          gitProvider: gitInfo.provider,
          gitOwner: gitInfo.owner,
          gitRepo: gitInfo.repo,
        })
        .where(eq(projects.id, existing.id))
        .returning()
        .get()

      // Track project opened
      trackProjectOpened({
        id: updatedProject!.id,
        hasGitRemote: !!gitInfo.remoteUrl,
      })

      return updatedProject
    }

    // Create new project with git info
    const newProject = db
      .insert(projects)
      .values({
        name: folderName,
        path: folderPath,
        gitRemoteUrl: gitInfo.remoteUrl,
        gitProvider: gitInfo.provider,
        gitOwner: gitInfo.owner,
        gitRepo: gitInfo.repo,
      })
      .returning()
      .get()

    // Track project opened
    trackProjectOpened({
      id: newProject!.id,
      hasGitRemote: !!gitInfo.remoteUrl,
    })

    return newProject
  }),

  /**
   * Create a project from a known path
   */
  create: publicProcedure
    .input(z.object({ path: z.string(), name: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDatabase()
      const normalizedPath = input.path.trim()
      const name = (input.name?.trim() || basename(normalizedPath)).trim()

      // Check if project already exists
      const existing = db
        .select()
        .from(projects)
        .where(eq(projects.path, normalizedPath))
        .get()

      if (existing) {
        return existing
      }

      // Get git remote info
      const gitInfo = await getGitRemoteInfo(normalizedPath)

      return db
        .insert(projects)
        .values({
          name,
          path: normalizedPath,
          gitRemoteUrl: gitInfo.remoteUrl,
          gitProvider: gitInfo.provider,
          gitOwner: gitInfo.owner,
          gitRepo: gitInfo.repo,
        })
        .returning()
        .get()
    }),

  /**
   * Rename a project
   */
  rename: publicProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(({ input }) => {
      const db = getDatabase()
      return db
        .update(projects)
        .set({ name: input.name.trim(), updatedAt: new Date() })
        .where(eq(projects.id, input.id))
        .returning()
        .get()
    }),

  relinkChatWorkspace: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDatabase()
      const chat = db
        .select()
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .get()

      if (!chat) {
        throw new Error("Chat not found")
      }

      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, chat.projectId))
        .get()

      if (!project) {
        throw new Error("Project not found")
      }

      const window = ctx.getWindow?.() ?? BrowserWindow.getFocusedWindow()
      if (!window) {
        return { success: false as const, reason: "no-window" as const }
      }

      if (!window.isFocused()) {
        window.focus()
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const result = await dialog.showOpenDialog(window, {
        properties: ["openDirectory"],
        title: `Relink ${project.name}`,
        buttonLabel: "Use folder",
      })

      if (result.canceled || !result.filePaths[0]) {
        return { success: false as const, reason: "canceled" as const }
      }

      const folderPath = result.filePaths[0]!.trim()
      const folderName = basename(folderPath).trim()
      const previousProjectPath = project.path.trim()
      const existingProject = db
        .select()
        .from(projects)
        .where(eq(projects.path, folderPath))
        .get()
      const gitInfo = await getGitRemoteInfo(folderPath)

      let targetProjectId = project.id
      let updatedProject = project

      if (existingProject && existingProject.id !== project.id) {
        targetProjectId = existingProject.id
        updatedProject = db
          .update(projects)
          .set({
            updatedAt: new Date(),
            gitRemoteUrl: gitInfo.remoteUrl,
            gitProvider: gitInfo.provider,
            gitOwner: gitInfo.owner,
            gitRepo: gitInfo.repo,
          })
          .where(eq(projects.id, existingProject.id))
          .returning()
          .get() || existingProject
      } else {
        const shouldRenameProject =
          project.name.trim() === basename(previousProjectPath) ||
          project.name.trim() === basename(previousProjectPath.trim())

        updatedProject = db
          .update(projects)
          .set({
            name: shouldRenameProject ? folderName : project.name.trim(),
            path: folderPath,
            updatedAt: new Date(),
            gitRemoteUrl: gitInfo.remoteUrl,
            gitProvider: gitInfo.provider,
            gitOwner: gitInfo.owner,
            gitRepo: gitInfo.repo,
          })
          .where(eq(projects.id, project.id))
          .returning()
          .get() || project

        const localChatsToRelink = db
          .select({ id: chats.id, worktreePath: chats.worktreePath })
          .from(chats)
          .where(eq(chats.projectId, project.id))
          .all()
          .filter((candidate) => {
            const normalizedWorktree = candidate.worktreePath?.trim()
            return (
              !normalizedWorktree ||
              normalizedWorktree === previousProjectPath
            )
          })

        if (localChatsToRelink.length > 0) {
          db.update(chats)
            .set({
              worktreePath: folderPath,
              updatedAt: new Date(),
            })
            .where(inArray(chats.id, localChatsToRelink.map((candidate) => candidate.id)))
            .run()
        }
      }

      const updatedChat = db
        .update(chats)
        .set({
          projectId: targetProjectId,
          worktreePath: folderPath,
          updatedAt: new Date(),
        })
        .where(eq(chats.id, chat.id))
        .returning()
        .get()

      return {
        success: true as const,
        project: updatedProject,
        chat: updatedChat,
      }
    }),

  /**
   * Delete a project and all its chats
   */
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const db = getDatabase()
      return db
        .delete(projects)
        .where(eq(projects.id, input.id))
        .returning()
        .get()
    }),

  /**
   * Refresh git info for a project (in case remote changed)
   */
  refreshGitInfo: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDatabase()

      // Get project
      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, input.id))
        .get()

      if (!project) {
        return null
      }

      // Get fresh git info
      const gitInfo = await getGitRemoteInfo(project.path)

      // Update project
      return db
        .update(projects)
        .set({
          updatedAt: new Date(),
          gitRemoteUrl: gitInfo.remoteUrl,
          gitProvider: gitInfo.provider,
          gitOwner: gitInfo.owner,
          gitRepo: gitInfo.repo,
        })
        .where(eq(projects.id, input.id))
        .returning()
        .get()
    }),

  /**
   * Clone a GitHub repo and create a project
   */
  cloneFromGitHub: publicProcedure
    .input(z.object({ repoUrl: z.string() }))
    .mutation(async ({ input }) => {
      const { repoUrl } = input

      // Parse the URL to extract owner/repo
      let owner: string | null = null
      let repo: string | null = null

      // Match HTTPS format: https://github.com/owner/repo
      const httpsMatch = repoUrl.match(
        /https?:\/\/github\.com\/([^/]+)\/([^/]+)/,
      )
      if (httpsMatch) {
        owner = httpsMatch[1] || null
        repo = httpsMatch[2]?.replace(/\.git$/, "") || null
      }

      // Match SSH format: git@github.com:owner/repo
      const sshMatch = repoUrl.match(/git@github\.com:([^/]+)\/(.+)/)
      if (sshMatch) {
        owner = sshMatch[1] || null
        repo = sshMatch[2]?.replace(/\.git$/, "") || null
      }

      // Match short format: owner/repo
      const shortMatch = repoUrl.match(/^([^/]+)\/([^/]+)$/)
      if (shortMatch) {
        owner = shortMatch[1] || null
        repo = shortMatch[2]?.replace(/\.git$/, "") || null
      }

      if (!owner || !repo) {
        throw new Error("Invalid GitHub URL or repo format")
      }

      // Clone to ~/.21st/repos/{owner}/{repo}
      const homePath = app.getPath("home")
      const reposDir = join(homePath, ".21st", "repos", owner)
      const clonePath = join(reposDir, repo)

      // Check if already cloned
      if (existsSync(clonePath)) {
        // Project might already exist in DB
        const db = getDatabase()
        const existing = db
          .select()
          .from(projects)
          .where(eq(projects.path, clonePath))
          .get()

        if (existing) {
          trackProjectOpened({
            id: existing.id,
            hasGitRemote: !!existing.gitRemoteUrl,
          })
          return existing
        }

        // Create project for existing clone
        const gitInfo = await getGitRemoteInfo(clonePath)
        const newProject = db
          .insert(projects)
          .values({
            name: repo,
            path: clonePath,
            gitRemoteUrl: gitInfo.remoteUrl,
            gitProvider: gitInfo.provider,
            gitOwner: gitInfo.owner,
            gitRepo: gitInfo.repo,
          })
          .returning()
          .get()

        trackProjectOpened({
          id: newProject!.id,
          hasGitRemote: !!gitInfo.remoteUrl,
        })
        return newProject
      }

      // Create repos directory
      await mkdir(reposDir, { recursive: true })

      // Clone the repo
      const cloneUrl = `https://github.com/${owner}/${repo}.git`
      await execAsync(`git clone "${cloneUrl}" "${clonePath}"`)

      // Get git info and create project
      const db = getDatabase()
      const gitInfo = await getGitRemoteInfo(clonePath)

      const newProject = db
        .insert(projects)
        .values({
          name: repo,
          path: clonePath,
          gitRemoteUrl: gitInfo.remoteUrl,
          gitProvider: gitInfo.provider,
          gitOwner: gitInfo.owner,
          gitRepo: gitInfo.repo,
        })
        .returning()
        .get()

      trackProjectOpened({
        id: newProject!.id,
        hasGitRemote: !!gitInfo.remoteUrl,
      })

      return newProject
    }),

  /**
   * Open folder picker to locate an existing clone of a specific repo
   * Validates that the selected folder matches the expected owner/repo
   */
  locateAndAddProject: publicProcedure
    .input(
      z.object({
        expectedOwner: z.string(),
        expectedRepo: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const window = ctx.getWindow?.() ?? BrowserWindow.getFocusedWindow()

      if (!window) {
        return { success: false as const, reason: "no-window" as const }
      }

      // Ensure window is focused
      if (!window.isFocused()) {
        window.focus()
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const result = await dialog.showOpenDialog(window, {
        properties: ["openDirectory"],
        title: `Locate ${input.expectedOwner}/${input.expectedRepo}`,
        buttonLabel: "Select",
      })

      if (result.canceled || !result.filePaths[0]) {
        return { success: false as const, reason: "canceled" as const }
      }

      const folderPath = result.filePaths[0]
      const gitInfo = await getGitRemoteInfo(folderPath)

      // Validate it's the correct repo
      if (
        gitInfo.owner !== input.expectedOwner ||
        gitInfo.repo !== input.expectedRepo
      ) {
        return {
          success: false as const,
          reason: "wrong-repo" as const,
          found:
            gitInfo.owner && gitInfo.repo
              ? `${gitInfo.owner}/${gitInfo.repo}`
              : "not a git repository",
        }
      }

      // Create or update project
      const db = getDatabase()
      const existing = db
        .select()
        .from(projects)
        .where(eq(projects.path, folderPath))
        .get()

      if (existing) {
        // Update git info in case it changed
        const updated = db
          .update(projects)
          .set({
            updatedAt: new Date(),
            gitRemoteUrl: gitInfo.remoteUrl,
            gitProvider: gitInfo.provider,
            gitOwner: gitInfo.owner,
            gitRepo: gitInfo.repo,
          })
          .where(eq(projects.id, existing.id))
          .returning()
          .get()

        return { success: true as const, project: updated }
      }

      const project = db
        .insert(projects)
        .values({
          name: basename(folderPath),
          path: folderPath,
          gitRemoteUrl: gitInfo.remoteUrl,
          gitProvider: gitInfo.provider,
          gitOwner: gitInfo.owner,
          gitRepo: gitInfo.repo,
        })
        .returning()
        .get()

      return { success: true as const, project }
    }),

  /**
   * Open folder picker to choose where to clone a repository
   */
  pickCloneDestination: publicProcedure
    .input(z.object({ suggestedName: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const window = ctx.getWindow?.() ?? BrowserWindow.getFocusedWindow()

      if (!window) {
        return { success: false as const, reason: "no-window" as const }
      }

      // Ensure window is focused
      if (!window.isFocused()) {
        window.focus()
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Default to ~/.21st/repos/
      const homePath = app.getPath("home")
      const defaultPath = join(homePath, ".21st", "repos")
      await mkdir(defaultPath, { recursive: true })

      const result = await dialog.showOpenDialog(window, {
        properties: ["openDirectory", "createDirectory"],
        title: "Choose where to clone",
        defaultPath,
        buttonLabel: "Clone Here",
      })

      if (result.canceled || !result.filePaths[0]) {
        return { success: false as const, reason: "canceled" as const }
      }

      const targetPath = join(result.filePaths[0], input.suggestedName)
      return { success: true as const, targetPath }
    }),

  /**
   * Upload a custom icon for a project (opens file picker for images)
   */
  uploadIcon: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const window = ctx.getWindow?.() ?? BrowserWindow.getFocusedWindow()
      if (!window) return null

      if (!window.isFocused()) {
        window.focus()
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const result = await dialog.showOpenDialog(window, {
        properties: ["openFile"],
        title: "Select Project Icon",
        buttonLabel: "Set Icon",
        filters: [
          { name: "Images", extensions: ["png", "jpg", "jpeg", "svg", "webp", "ico"] },
        ],
      })

      if (result.canceled || !result.filePaths[0]) return null

      const sourcePath = result.filePaths[0]
      const ext = extname(sourcePath)
      const iconsDir = join(app.getPath("userData"), "project-icons")
      await mkdir(iconsDir, { recursive: true })

      const destPath = join(iconsDir, `${input.id}${ext}`)
      await copyFile(sourcePath, destPath)

      const db = getDatabase()
      return db
        .update(projects)
        .set({ iconPath: destPath, updatedAt: new Date() })
        .where(eq(projects.id, input.id))
        .returning()
        .get()
    }),

  /**
   * Remove custom icon for a project
   */
  removeIcon: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDatabase()
      const project = db.select().from(projects).where(eq(projects.id, input.id)).get()

      if (project?.iconPath && existsSync(project.iconPath)) {
        try { await unlink(project.iconPath) } catch {}
      }

      return db
        .update(projects)
        .set({ iconPath: null, updatedAt: new Date() })
        .where(eq(projects.id, input.id))
        .returning()
        .get()
    }),
})
