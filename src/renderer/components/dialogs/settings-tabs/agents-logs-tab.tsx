import { useMemo } from "react"
import { toast } from "sonner"
import { Button } from "../../ui/button"
import { trpc } from "../../../lib/trpc"

export function AgentsLogsTab() {
  const { data } = trpc.zai.getLogTail.useQuery(undefined, {
    refetchInterval: 2000,
  })

  const logPath = data?.path ?? ""
  const tail = data?.lines ?? []

  const tailText = useMemo(() => tail.join("\n"), [tail])

  const handleOpenLogFile = async () => {
    if (!logPath) return
    const result = await window.desktopApi.openPath(logPath)
    if (result) {
      toast.error(result)
    }
  }

  const handleCopyPath = async () => {
    if (!logPath) return
    await window.desktopApi.clipboardWrite(logPath)
    toast.success("Log path copied")
  }

  return (
    <div className="px-6 py-5 space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Logs</h2>
        <p className="text-sm text-muted-foreground">
          View the main-process log file and copy the path for debugging.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Main log file</p>
          <p className="text-xs text-muted-foreground break-all">
            {logPath || "Log path unavailable"}
          </p>
        </div>

        <div className="flex gap-2">
          <Button type="button" onClick={() => void handleOpenLogFile()} disabled={!logPath}>
            Open log file ↗
          </Button>
          <Button type="button" variant="outline" onClick={() => void handleCopyPath()} disabled={!logPath}>
            Copy log path
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Recent lines</p>
        <pre className="min-h-[280px] rounded-lg border border-border bg-black/70 p-4 text-xs leading-5 text-zinc-200 overflow-x-auto whitespace-pre-wrap">
          {tailText || "No log lines yet."}
        </pre>
      </div>
    </div>
  )
}
