import { Provider as JotaiProvider, useAtomValue, useSetAtom } from "jotai"
import { ThemeProvider, useTheme } from "next-themes"
import { useEffect, useMemo, useRef, useState } from "react"
import { Toaster } from "sonner"
import { TooltipProvider } from "./components/ui/tooltip"
import { TRPCProvider } from "./contexts/TRPCProvider"
import { WindowProvider, getInitialWindowParams } from "./contexts/WindowContext"
import {
  selectedProjectAtom,
  selectedAgentChatIdAtom,
  selectedChatIsRemoteAtom,
  selectedDraftIdAtom,
  showNewChatFormAtom,
} from "./features/agents/atoms"
import { useAgentSubChatStore } from "./features/agents/stores/sub-chat-store"
import { AgentsLayout } from "./features/layout/agents-layout"
import { SelectRepoPage, ZaiOnboardingPage } from "./features/onboarding"
import { appStore } from "./lib/jotai-store"
import {
  betaAutomationsEnabledAtom,
  chatSourceModeAtom,
  desktopViewAtom,
  selectedTeamIdAtom,
} from "./lib/atoms"
import { isDesktopApp } from "./lib/utils/platform"
import { rlog } from "./lib/logger"
import { VSCodeThemeProvider } from "./lib/themes/theme-provider"
import { trpc } from "./lib/trpc"

/**
 * Custom Toaster that adapts to theme
 */
function ThemedToaster() {
  const { resolvedTheme } = useTheme()

  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme as "light" | "dark" | "system"}
      closeButton
    />
  )
}

type BootState =
  | "checking_config"
  | "needs_config"
  | "checking_projects"
  | "needs_workspace"
  | "ready"
  | "error"

function SplashScreen() {
  return <div className="h-screen w-screen bg-background" />
}

function ErrorScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-xl border border-border bg-card p-5 text-center">
        <div className="text-base font-semibold">GLMX could not finish booting</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Try reopening the app or reselecting your workspace.
        </div>
      </div>
    </div>
  )
}

/**
 * Main content router - decides which page to show based on local ZAI config state
 */
function AppContent() {
  const [bootState, setBootState] = useState<BootState>("checking_config")
  const bootStartedAt = useRef(Date.now())
  const lastBootTransitionAt = useRef(Date.now())
  const previousBootState = useRef<BootState>("checking_config")
  const selectedProject = useAtomValue(selectedProjectAtom)
  const setSelectedProject = useSetAtom(selectedProjectAtom)
  const setSelectedChatId = useSetAtom(selectedAgentChatIdAtom)
  const setSelectedChatIsRemote = useSetAtom(selectedChatIsRemoteAtom)
  const setSelectedDraftId = useSetAtom(selectedDraftIdAtom)
  const setShowNewChatForm = useSetAtom(showNewChatFormAtom)
  const setSelectedTeamId = useSetAtom(selectedTeamIdAtom)
  const setChatSourceMode = useSetAtom(chatSourceModeAtom)
  const setBetaAutomationsEnabled = useSetAtom(betaAutomationsEnabledAtom)
  const setDesktopView = useSetAtom(desktopViewAtom)
  const { setActiveSubChat, addToOpenSubChats, setChatId } = useAgentSubChatStore()
  const didInitializeDesktopSession = useRef(false)

  useEffect(() => {
    if (!isDesktopApp() || didInitializeDesktopSession.current) return

    didInitializeDesktopSession.current = true

    // Bootstrap sanitization already cleared persisted cloud-only state.
    // Keep the runtime initialization here minimal to avoid mount-time write storms.
    useAgentSubChatStore.getState().reset()
    setSelectedChatIsRemote(false)
    setSelectedTeamId(null)
    setChatSourceMode("local")
    setBetaAutomationsEnabled(false)
    setSelectedDraftId(null)
    setShowNewChatForm(true)
    setDesktopView(null)
  }, [
    setBetaAutomationsEnabled,
    setChatSourceMode,
    setDesktopView,
    setSelectedChatId,
    setSelectedChatIsRemote,
    setSelectedDraftId,
    setSelectedTeamId,
    setShowNewChatForm,
  ])

  // Apply initial window params (chatId/subChatId) when opening via "Open in new window"
  useEffect(() => {
    const params = getInitialWindowParams()
    if (params.chatId) {
      console.log("[App] Opening chat from window params:", params.chatId, params.subChatId)
      setSelectedChatId(params.chatId)
      setChatId(params.chatId)
      if (params.subChatId) {
        addToOpenSubChats(params.subChatId)
        setActiveSubChat(params.subChatId)
      }
    }
  }, [setSelectedChatId, setChatId, addToOpenSubChats, setActiveSubChat])

  // Claim the initially selected chat to prevent duplicate windows.
  // For new windows opened via "Open in new window", the chat is pre-claimed by main process.
  // For restored windows (persisted localStorage), we need to claim here.
  // Read atom directly from store to avoid stale closure with empty deps.
  useEffect(() => {
    if (!window.desktopApi?.claimChat) return
    const currentChatId = appStore.get(selectedAgentChatIdAtom)
    if (!currentChatId) return
    window.desktopApi.claimChat(currentChatId).then((result) => {
      if (!result.ok) {
        // Another window already has this chat — clear our selection
        setSelectedChatId(null)
      }
    })
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const configQuery = trpc.zai.isConfigured.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 30_000,
  })
  const {
    data: isConfigured,
    isLoading: isLoadingConfig,
    refetch: refetchConfig,
    isError: isConfigError,
  } = configQuery

  // Fetch projects to validate selectedProject exists
  const projectsQuery = trpc.projects.list.useQuery(undefined, {
    enabled: !!isConfigured,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 30_000,
  })
  const {
    data: projects,
    isLoading: isLoadingProjects,
    isError: isProjectsError,
  } = projectsQuery

  // Validated project - only valid if exists in DB
  const validatedProject = useMemo(() => {
    if (!selectedProject) return null
    // While loading, trust localStorage value to prevent flicker
    if (isLoadingProjects) return selectedProject
    // After loading, validate against DB
    if (!projects) return null
    const dbProject = projects.find((p) => p.id === selectedProject.id)
    if (!dbProject || dbProject.pathExists === false) return null
    return {
      ...selectedProject,
      name: dbProject.name,
      path: dbProject.path,
      gitRemoteUrl: dbProject.gitRemoteUrl,
      gitProvider: dbProject.gitProvider as
        | "github"
        | "gitlab"
        | "bitbucket"
        | null,
      gitOwner: dbProject.gitOwner,
      gitRepo: dbProject.gitRepo,
    }
  }, [selectedProject, projects, isLoadingProjects])

  useEffect(() => {
    if (!selectedProject || !validatedProject) return

    const hasSameIdentity =
      selectedProject.id === validatedProject.id &&
      selectedProject.name === validatedProject.name &&
      selectedProject.path === validatedProject.path &&
      selectedProject.gitRemoteUrl === validatedProject.gitRemoteUrl &&
      selectedProject.gitProvider === validatedProject.gitProvider &&
      selectedProject.gitOwner === validatedProject.gitOwner &&
      selectedProject.gitRepo === validatedProject.gitRepo

    if (hasSameIdentity) return

    setSelectedProject(validatedProject)
  }, [
    selectedProject?.id,
    selectedProject?.name,
    selectedProject?.path,
    selectedProject?.gitRemoteUrl,
    selectedProject?.gitProvider,
    selectedProject?.gitOwner,
    selectedProject?.gitRepo,
    validatedProject?.id,
    validatedProject?.name,
    validatedProject?.path,
    validatedProject?.gitRemoteUrl,
    validatedProject?.gitProvider,
    validatedProject?.gitOwner,
    validatedProject?.gitRepo,
    setSelectedProject,
  ])

  useEffect(() => {
    if (isLoadingProjects) return
    if (!selectedProject || validatedProject) return

    useAgentSubChatStore.getState().reset()
    setSelectedChatId(null)
    setSelectedProject(null)
  }, [
    isLoadingProjects,
    selectedProject?.id,
    validatedProject?.id,
    setSelectedChatId,
    setSelectedProject,
  ])

  useEffect(() => {
    if (isConfigError || isProjectsError) {
      setBootState("error")
      return
    }

    if (isLoadingConfig) {
      setBootState("checking_config")
      return
    }

    if (!isConfigured) {
      setBootState("needs_config")
      return
    }

    if (isLoadingProjects) {
      setBootState("checking_projects")
      return
    }

    if (!projects?.length || !validatedProject) {
      setBootState("needs_workspace")
      return
    }

    setBootState("ready")
  }, [
    isConfigError,
    isProjectsError,
    isLoadingConfig,
    isConfigured,
    isLoadingProjects,
    projects?.length,
    validatedProject?.id,
  ])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setBootState((prev) => {
        if (prev === "checking_config" || prev === "checking_projects") {
          rlog.boot.warn("boot_slow", {
            state: prev,
            elapsedMs: Date.now() - bootStartedAt.current,
          })
          return "needs_workspace"
        }
        return prev
      })
    }, 3000)

    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    const from = previousBootState.current
    const to = bootState
    const now = Date.now()
    const durationMs = now - lastBootTransitionAt.current

    if (from !== to) {
      rlog.boot.info("state_changed", { from, to, durationMs })
      previousBootState.current = to
      lastBootTransitionAt.current = now
    }

    if (to === "ready") {
      rlog.boot.info("boot_complete", {
        totalMs: now - bootStartedAt.current,
      })
    }
  }, [bootState])

  if (bootState === "checking_config" || bootState === "checking_projects") {
    return <SplashScreen />
  }

  if (bootState === "needs_config") {
    return <ZaiOnboardingPage onComplete={() => void refetchConfig()} />
  }

  if (bootState === "needs_workspace") {
    return <SelectRepoPage />
  }

  if (bootState === "error") {
    return <ErrorScreen />
  }

  return <AgentsLayout />
}

export function App() {
  return (
    <WindowProvider>
      <JotaiProvider store={appStore}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <VSCodeThemeProvider>
            <TooltipProvider delayDuration={100}>
              <TRPCProvider>
                <div
                  data-agents-page
                  className="h-screen w-screen bg-background text-foreground overflow-hidden"
                >
                  <AppContent />
                </div>
                <ThemedToaster />
              </TRPCProvider>
            </TooltipProvider>
          </VSCodeThemeProvider>
        </ThemeProvider>
      </JotaiProvider>
    </WindowProvider>
  )
}
