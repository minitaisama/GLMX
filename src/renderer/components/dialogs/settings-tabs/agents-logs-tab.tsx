import { useEffect } from "react"
import { Button } from "../../ui/button"
import { trpc } from "../../../lib/trpc"

export function AgentsLogsTab() {
  const pathsQuery = trpc.zai.getLogPaths.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  })
  const modelTailQuery = trpc.zai.getModelLogTail.useQuery(
    { lines: 30 },
    {
      refetchInterval: 3000,
      refetchOnWindowFocus: true,
    },
  )
  const mainTailQuery = trpc.zai.getMainLogTail.useQuery(
    { lines: 15 },
    {
      refetchInterval: 3000,
      refetchOnWindowFocus: true,
    },
  )

  const openLogFile = trpc.zai.openLogFile.useMutation()
  const copyLogPath = trpc.zai.copyLogPath.useMutation()

  useEffect(() => {
    void pathsQuery.refetch()
  }, [pathsQuery])

  return (
    <div className="space-y-6 px-6 py-6">
      <div>
        <h2 className="text-lg font-semibold">Logs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Inspect live model and app logs without leaving GLMX.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => openLogFile.mutate({ kind: "model" })}
        >
          Open model.log
        </Button>
        <Button
          variant="outline"
          onClick={() => openLogFile.mutate({ kind: "main" })}
        >
          Open main.log
        </Button>
        <Button
          variant="outline"
          onClick={() => copyLogPath.mutate({ kind: "model" })}
        >
          Copy model.log path
        </Button>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Paths</div>
        <div className="rounded-lg border border-border bg-card p-3 font-mono text-xs text-muted-foreground">
          <div>model: {pathsQuery.data?.model ?? "…"}</div>
          <div>main: {pathsQuery.data?.main ?? "…"}</div>
          <div>quality: {pathsQuery.data?.quality ?? "…"}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">model.log</div>
        <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-black/80 p-3 font-mono text-xs text-zinc-100">
          {(modelTailQuery.data ?? []).join("\n") || "No model log entries yet."}
        </pre>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">main.log</div>
        <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-black/80 p-3 font-mono text-xs text-zinc-100">
          {(mainTailQuery.data ?? []).join("\n") || "No main log entries yet."}
        </pre>
      </div>
    </div>
  )
}
