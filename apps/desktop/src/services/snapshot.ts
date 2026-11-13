import { isTauri } from "@/lib/platform";
import { callCommand } from "@/services/tauri";

export type SnapshotStatus = { loaded: boolean; patch: string | null };
export type SnapshotRefresh = { outcome: "updated" | "notModified"; status: SnapshotStatus };

/**
 * api に問い合わせて、手元の統計スナップショットを更新する(Rust 側が ETag で差分だけ取る)。
 * ブラウザでの開発時は、スナップショットを持たないので何もしない
 */
export async function refreshSnapshot(): Promise<SnapshotRefresh> {
  if (!isTauri) return { outcome: "notModified", status: { loaded: false, patch: null } };
  return callCommand<SnapshotRefresh>("refresh_snapshot");
}
