import { poolEntriesSchema, profileSchema } from "@draftgg/shared";
import type { Profile } from "@draftgg/shared";

import { jsonInit, request } from "@/services/http";
import { callCommand } from "@/services/tauri";

/**
 * OP.GG の使用履歴から、プールの候補を取り込む。
 * api はログイン無しの取得だけを担当し、結果をどう混ぜるか(手動の項目や除外の設定を残す)は
 * ローカル保存側が決める。失敗したら、ローカルは変えない。
 * エラーは api のコード(`sync_too_soon` / `busy` / `sync_failed` など)を message にした Error
 */
export async function syncProfilePool(profile: Profile): Promise<Profile> {
  if (!profile.riotId || !profile.region) throw new Error("riot_id_required");

  const response = await request(
    "/api/pool-sync",
    jsonInit("POST", {
      riotId: profile.riotId,
      region: profile.region,
      roles: profile.roles,
    }),
  );
  const body: unknown = await response.json().catch(() => null);
  const parsed = poolEntriesSchema.safeParse(
    typeof body === "object" && body !== null ? (body as { entries?: unknown }).entries : null,
  );
  if (!parsed.success) throw new Error("sync_failed");

  return profileSchema.parse(
    await callCommand("apply_pool_sync", { id: profile.id, entries: parsed.data }),
  );
}
