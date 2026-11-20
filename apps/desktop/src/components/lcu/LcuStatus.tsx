import { useLcu } from "@/hooks/use-lcu";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

/** ステータスバーに出す、LoL クライアントとの接続状況。反映中だけ印の色を付ける */
export function LcuStatus() {
  const { state } = useLcu();

  return (
    <div role="status" className="flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          state.status === "champSelect" ? "bg-selection" : "bg-muted-foreground/40",
        )}
      />
      <span className={cn("truncate", state.status === "champSelect" && "text-foreground")}>
        {ja.lcu[state.status]}
      </span>
    </div>
  );
}
