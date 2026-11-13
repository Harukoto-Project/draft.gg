import { InfoDialog } from "@/components/layout/InfoDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStatus } from "@/hooks/use-status";
import { formatMessage } from "@/lib/formatMessage";
import { formatUpdatedAt, latestUpdate } from "@/lib/status";
import ja from "@/messages/ja.json";

/** 下端のステータスバー。パッチとデータの更新時刻を1行で示し、詳細と権利表記は「情報」から開く */
export function AppStatusBar() {
  const status = useStatus();

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-muted/50 px-3 font-chrome text-xs text-muted-foreground">
      <div className="flex min-w-0 items-center gap-4" role="status">
        <StatusSummary status={status} />
      </div>
      <div className="ml-auto flex shrink-0 items-center">
        <InfoDialog />
      </div>
    </footer>
  );
}

function StatusSummary({ status }: { status: ReturnType<typeof useStatus> }) {
  if (status.isPending) return <Skeleton className="h-3.5 w-56" aria-hidden="true" />;

  if (!status.data) {
    return (
      <>
        <span className="truncate text-foreground">{ja.status.loadError}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => void status.refetch()}
        >
          {ja.status.retry}
        </Button>
      </>
    );
  }

  const { patch } = status.data;
  const latest = latestUpdate(status.data);
  return (
    <>
      <span className="tabular-nums">
        {patch ? formatMessage(ja.status.patch, { version: patch }) : ja.status.patchUnknown}
      </span>
      <span className="truncate tabular-nums">
        {latest
          ? formatMessage(ja.status.updated, { time: formatUpdatedAt(latest) })
          : ja.status.updatedNone}
      </span>
    </>
  );
}
