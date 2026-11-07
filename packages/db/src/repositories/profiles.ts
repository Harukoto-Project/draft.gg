import { MAX_PROFILES_PER_USER, mergeSyncedPool } from "@draftgg/shared";
import type { PoolEntry, Profile, ProfileInput, ProfilePatch, RiotRegion } from "@draftgg/shared";
import { and, count, eq, inArray } from "drizzle-orm";

import type { Database } from "../client.js";
import { champions, playerPoolEntries, playerProfiles } from "../schema/index.js";

type ProfileRow = typeof playerProfiles.$inferSelect;
type PoolRow = typeof playerPoolEntries.$inferSelect;
type Executor = Pick<Database, "select" | "insert" | "update" | "delete">;

function toEntry(row: PoolRow): PoolEntry {
  return {
    championId: row.championId,
    position: row.position,
    source: row.source,
    games: row.games,
    winRate: row.winRate === null ? null : Number(row.winRate),
    excluded: row.excluded,
  };
}

function toProfile(row: ProfileRow, pool: PoolRow[]): Profile {
  return {
    id: row.id,
    displayName: row.displayName,
    riotId: row.riotId,
    region: (row.region as RiotRegion | null) ?? null,
    roles: row.roles,
    syncedAt: row.syncedAt ? row.syncedAt.toISOString() : null,
    pool: pool.map(toEntry),
  };
}

function toPoolRows(profileId: string, entries: PoolEntry[]): PoolRow[] {
  return entries.map((entry) => ({
    profileId,
    championId: entry.championId,
    position: entry.position,
    source: entry.source,
    games: entry.games,
    winRate: entry.winRate === null ? null : entry.winRate.toFixed(4),
    excluded: entry.excluded,
  }));
}

async function loadPools(db: Executor, profileIds: string[]): Promise<Map<string, PoolRow[]>> {
  const pools = new Map<string, PoolRow[]>();
  if (profileIds.length === 0) return pools;
  const rows = await db
    .select()
    .from(playerPoolEntries)
    .where(inArray(playerPoolEntries.profileId, profileIds));
  for (const row of rows) {
    const list = pools.get(row.profileId) ?? [];
    list.push(row);
    pools.set(row.profileId, list);
  }
  return pools;
}

async function loadOne(db: Executor, ownerId: string, id: string): Promise<Profile | null> {
  const [row] = await db
    .select()
    .from(playerProfiles)
    .where(and(eq(playerProfiles.id, id), eq(playerProfiles.ownerId, ownerId)));
  if (!row) return null;
  const pools = await loadPools(db, [row.id]);
  return toProfile(row, pools.get(row.id) ?? []);
}

async function writePool(db: Executor, profileId: string, entries: PoolEntry[]): Promise<void> {
  await db.delete(playerPoolEntries).where(eq(playerPoolEntries.profileId, profileId));
  if (entries.length > 0) {
    await db.insert(playerPoolEntries).values(toPoolRows(profileId, entries));
  }
}

/** プレイヤーとプールの保存先。すべての操作を ownerId で絞り、他人のデータには触れない */
export interface ProfileStore {
  list(ownerId: string): Promise<Profile[]>;
  get(ownerId: string, id: string): Promise<Profile | null>;
  /** 上限を超えるときは "limit" */
  create(ownerId: string, input: ProfileInput): Promise<Profile | "limit">;
  update(ownerId: string, id: string, patch: ProfilePatch): Promise<Profile | null>;
  remove(ownerId: string, id: string): Promise<boolean>;
  /** 存在しないチャンピオンが含まれるときは "unknown_champion" */
  replacePool(
    ownerId: string,
    id: string,
    entries: PoolEntry[],
  ): Promise<Profile | null | "unknown_champion">;
  /** OP.GG から取ったプールを反映し、同期日時を記録する */
  applySync(
    ownerId: string,
    id: string,
    synced: PoolEntry[],
    syncedAt: Date,
  ): Promise<Profile | null>;
}

export function createProfileStore(db: Database): ProfileStore {
  return {
    async list(ownerId) {
      const rows = await db
        .select()
        .from(playerProfiles)
        .where(eq(playerProfiles.ownerId, ownerId))
        .orderBy(playerProfiles.createdAt);
      const pools = await loadPools(
        db,
        rows.map((row) => row.id),
      );
      return rows.map((row) => toProfile(row, pools.get(row.id) ?? []));
    },

    get: (ownerId, id) => loadOne(db, ownerId, id),

    async create(ownerId, input) {
      const id = crypto.randomUUID();
      const created = await db.transaction(async (tx) => {
        const [total] = await tx
          .select({ value: count() })
          .from(playerProfiles)
          .where(eq(playerProfiles.ownerId, ownerId));
        if ((total?.value ?? 0) >= MAX_PROFILES_PER_USER) return false;
        await tx.insert(playerProfiles).values({
          id,
          ownerId,
          displayName: input.displayName,
          riotId: input.riotId,
          region: input.region,
          roles: input.roles,
        });
        return true;
      });
      if (!created) return "limit";
      const profile = await loadOne(db, ownerId, id);
      if (!profile) throw new Error("作成したプレイヤーを読み込めませんでした");
      return profile;
    },

    async update(ownerId, id, patch) {
      if (Object.keys(patch).length > 0) {
        const where = and(eq(playerProfiles.id, id), eq(playerProfiles.ownerId, ownerId));
        const [current] = await db.select().from(playerProfiles).where(where);
        // Riot ID かリージョンが変わったら、別のアカウントになるので同期の履歴を戻す
        // (誤字を直した直後でも、新しい ID で同期できるようにする)
        const identityChanged =
          current !== undefined &&
          ((patch.riotId !== undefined && patch.riotId !== current.riotId) ||
            (patch.region !== undefined && patch.region !== current.region));
        await db
          .update(playerProfiles)
          .set(identityChanged ? { ...patch, syncedAt: null } : patch)
          .where(where);
      }
      return loadOne(db, ownerId, id);
    },

    async remove(ownerId, id) {
      const [result] = await db
        .delete(playerProfiles)
        .where(and(eq(playerProfiles.id, id), eq(playerProfiles.ownerId, ownerId)));
      return result.affectedRows > 0;
    },

    async replacePool(ownerId, id, entries) {
      const ids = [...new Set(entries.map((entry) => entry.championId))];
      if (ids.length > 0) {
        const known = await db
          .select({ id: champions.id })
          .from(champions)
          .where(inArray(champions.id, ids));
        if (known.length !== ids.length) return "unknown_champion";
      }
      return db.transaction(async (tx) => {
        if (!(await loadOne(tx, ownerId, id))) return null;
        await writePool(tx, id, entries);
        return loadOne(tx, ownerId, id);
      });
    },

    async applySync(ownerId, id, synced, syncedAt) {
      return db.transaction(async (tx) => {
        const current = await loadOne(tx, ownerId, id);
        if (!current) return null;
        await writePool(tx, id, mergeSyncedPool(current.pool, synced));
        await tx.update(playerProfiles).set({ syncedAt }).where(eq(playerProfiles.id, id));
        return loadOne(tx, ownerId, id);
      });
    },
  };
}
