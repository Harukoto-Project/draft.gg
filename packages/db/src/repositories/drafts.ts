import { MAX_DRAFTS_PER_USER, draftStateSchema } from "@draftgg/shared";
import type { SavedDraft, SavedDraftInput } from "@draftgg/shared";
import { and, count, desc, eq } from "drizzle-orm";

import type { Database } from "../client.js";
import { drafts } from "../schema/index.js";

type DraftRow = typeof drafts.$inferSelect;

/** 形が今のスキーマに合わない古い行は、読み飛ばす(上限にも数えない) */
function toSavedDraft(row: DraftRow): SavedDraft | null {
  const state = draftStateSchema.safeParse(row.state);
  if (!state.success) return null;
  return {
    id: row.id,
    state: state.data,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 読み取れる(今のスキーマに合う)行の数 */
function countReadable(rows: readonly Pick<DraftRow, "state">[]): number {
  return rows.filter((row) => draftStateSchema.safeParse(row.state).success).length;
}

/** ドラフトの保存先。すべての操作を ownerId で絞り、他人のデータには触れない */
export interface DraftStore {
  /** 新しい順 */
  list(ownerId: string): Promise<SavedDraft[]>;
  /** 上限を超えるときは "limit" */
  create(ownerId: string, input: SavedDraftInput): Promise<SavedDraft | "limit">;
  remove(ownerId: string, id: string): Promise<boolean>;
}

export function createDraftStore(db: Database): DraftStore {
  return {
    async list(ownerId) {
      const rows = await db
        .select()
        .from(drafts)
        .where(eq(drafts.ownerId, ownerId))
        .orderBy(desc(drafts.createdAt));
      // 読み取れない行を除いても、上限までに収まる(読み取れない行は作成の上限に数えない)
      return rows.flatMap((row) => toSavedDraft(row) ?? []).slice(0, MAX_DRAFTS_PER_USER);
    },

    async create(ownerId, input) {
      const id = crypto.randomUUID();
      const result = await db.transaction(async (tx) => {
        const [total] = await tx
          .select({ value: count() })
          .from(drafts)
          .where(eq(drafts.ownerId, ownerId));
        if ((total?.value ?? 0) >= MAX_DRAFTS_PER_USER) {
          // スキーマを変えたあとの読み取れない行は、画面に出ず消せないので、上限に数えない
          const rows = await tx
            .select({ state: drafts.state })
            .from(drafts)
            .where(eq(drafts.ownerId, ownerId));
          if (countReadable(rows) >= MAX_DRAFTS_PER_USER) return "limit" as const;
        }
        await tx.insert(drafts).values({
          id,
          ownerId,
          format: input.state.format,
          mySide: input.state.mySide,
          state: input.state,
          note: input.note ?? "",
        });
        return "created" as const;
      });
      if (result === "limit") return result;
      const [row] = await db
        .select()
        .from(drafts)
        .where(and(eq(drafts.id, id), eq(drafts.ownerId, ownerId)));
      const saved = row ? toSavedDraft(row) : null;
      if (!saved) throw new Error("保存したドラフトを読み込めませんでした");
      return saved;
    },

    async remove(ownerId, id) {
      const [result] = await db
        .delete(drafts)
        .where(and(eq(drafts.id, id), eq(drafts.ownerId, ownerId)));
      return result.affectedRows > 0;
    },
  };
}
