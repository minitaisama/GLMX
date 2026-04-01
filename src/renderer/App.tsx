import { Provider as JotaiProvider, useAtomValue, useSetAtom } from "jotai"
import { ThemeProvider, useTheme } from "next-themes"
import { useEffect, useMemo } from "react"
import { Toaster } from "sonner"
import { TooltipProvider } from "./components/ui/tooltip"
import { TRPCProvider } from "./contexts/TRPCProvider"
import { WindowProvider, getInitialWindowParams } from "./contexts/WindowContext"
import {
  selectedProjectAtom,
  selectedAgentChatIdAtom,
  selectedChatIsRemoteAtom,
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

/**
 * Main content router - decides which page to show based on local ZAI config state
 */
function AppContent() {
  const selectedProject = useAtomValue(selectedProjectAtom)
  const setSelectedProject = useSetAtom(selectedProjectAtom)
  const setSelectedChatId = useSetAtom(selectedAgentChatIdAtom)
  const setSelectedChatIsRemote = useSetAtom(selectedChatIsRemoteAtom)
  const setSelectedTeamId = useSetAtom(selectedTeamIdAtom)
  const setChatSourceMode = useSetAtom(chatSourceModeAtom)
  const setBetaAutomationsEnabled = useSetAtom(betaAutomationsEnabledAtom)
  const setDesktopView = useSetAtom(desktopViewAtom)
  const { setActiveSubChat, addToOpenSubChats, setChatId } = useAgentSubChatStore()

  useEffect(() => {
    if (!isDesktopApp()) return

    const currentSelectedChatId = appStore.get(selectedAgentChatIdAtom)
    const selectedChatIsRemote = appStore.get(selectedChatIsRemoteAtom)
    const selectedTeamId = appStore.get(selectedTeamIdAtom)
    const chatSourceMode = appStore.get(chatSourceModeAtom)
    const desktopView = appStore.get(desktopViewAtom)
    const automationsEnabled = appStore.get(betaAutomationsEnabledAtom)

    // Clear stale cloud-only state restored from previous 1code / web sessions.
    if (currentSelectedChatId?.startsWith("remote_")) {
      setSelectedChatId(null)
    }
    if (selectedChatIsRemote) {
      setSelectedChatIsRemote(false)
    }
    if (selectedTeamId) {
      setSelectedTeamId(null)
    }
    if (chatSourceMode !== "local") {
      setChatSourceMode("local")
    }
    if (automationsEnabled) {
      setBetaAutomationsEnabled(false)
    }
    if (
      desktopView === "automations" ||
      desktopView === "automations-detail" ||
      desktopView === "inbox"
    ) {
      setDesktopView(null)
    }
  }, [
    setBetaAutomationsEnabled,
    setChatSourceMode,
    setDesktopView,
    setSelectedChatId,
    setSelectedChatIsRemote,
    setSelectedTeamId,
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

  const {
    data: isConfigured,
    isLoading: isLoadingConfig,
    refetch: refetchConfig,
  } = trpc.zai.isConfigured.useQuery()

  // Fetch projects to validate selectedProject exists
  const { data: projects, isLoading: isLoadingProjects } =
    trpc.projects.list.useQuery()

  // Validated project - only valid if exists in DB
  const validatedProject = useMemo(() => {
    if (!selectedProject) return null
    // While loading, trust localStorage value to prevent flicker
    if (isLoadingProjects) return selectedProject
    // After loading, validate against DB
    if (!projects) return null
    const dbProject = projects.find((p) => p.id === selectedProject.id)
    if (!dbProject) return null
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

  if (isLoadingConfig) {
    return <div className="h-screen w-screen bg-background" />
  }

  if (!isConfigured) {
    return <ZaiOnboardingPage onComplete={() => void refetchConfig()} />
  }

  if (!validatedProject && !isLoadingProjects) {
    return <SelectRepoPage />
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
