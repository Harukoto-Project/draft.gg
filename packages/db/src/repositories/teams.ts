import { MAX_TEAMS_PER_USER } from "@draftgg/shared";
import type { Team, TeamInput, TeamMembers, TeamPatch } from "@draftgg/shared";
import { and, count, eq, inArray } from "drizzle-orm";

import type { Database } from "../client.js";
import { playerProfiles, teamMembers, teams } from "../schema/index.js";

type TeamRow = typeof teams.$inferSelect;
type MemberRow = typeof teamMembers.$inferSelect;
type Executor = Pick<Database, "select" | "insert" | "update" | "delete">;

function toTeam(row: TeamRow, members: MemberRow[]): Team {
  const assigned: TeamMembers = {};
  for (const member of members) assigned[member.position] = member.profileId;
  return { id: row.id, name: row.name, members: assigned };
}

async function loadMembers(db: Executor, teamIds: string[]): Promise<Map<string, MemberRow[]>> {
  const byTeam = new Map<string, MemberRow[]>();
  if (teamIds.length === 0) return byTeam;
  const rows = await db.select().from(teamMembers).where(inArray(teamMembers.teamId, teamIds));
  for (const row of rows) {
    const list = byTeam.get(row.teamId) ?? [];
    list.push(row);
    byTeam.set(row.teamId, list);
  }
  return byTeam;
}

async function loadOne(db: Executor, ownerId: string, id: string): Promise<Team | null> {
  const [row] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, id), eq(teams.ownerId, ownerId)));
  if (!row) return null;
  const members = await loadMembers(db, [row.id]);
  return toTeam(row, members.get(row.id) ?? []);
}

/** 割り当てたプレイヤーが、すべてこのユーザーのものか */
async function ownsAll(db: Executor, ownerId: string, members: TeamMembers): Promise<boolean> {
  const ids = [...new Set(Object.values(members))];
  if (ids.length === 0) return true;
  const rows = await db
    .select({ id: playerProfiles.id })
    .from(playerProfiles)
    .where(and(eq(playerProfiles.ownerId, ownerId), inArray(playerProfiles.id, ids)));
  return rows.length === ids.length;
}

async function writeMembers(db: Executor, teamId: string, members: TeamMembers): Promise<void> {
  await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
  const rows = Object.entries(members).map(([position, profileId]) => ({
    teamId,
    position: position as MemberRow["position"],
    profileId,
  }));
  if (rows.length > 0) await db.insert(teamMembers).values(rows);
}

/** チームの保存先。すべての操作を ownerId で絞り、他人のデータには触れない */
export interface TeamStore {
  list(ownerId: string): Promise<Team[]>;
  /** 上限を超えるときは "limit"、他人のプレイヤーを含むときは "unknown_profile" */
  create(ownerId: string, input: TeamInput): Promise<Team | "limit" | "unknown_profile">;
  /** `members` を渡したときは、割り当て全体を置き換える */
  update(ownerId: string, id: string, patch: TeamPatch): Promise<Team | null | "unknown_profile">;
  remove(ownerId: string, id: string): Promise<boolean>;
}

export function createTeamStore(db: Database): TeamStore {
  return {
    async list(ownerId) {
      const rows = await db
        .select()
        .from(teams)
        .where(eq(teams.ownerId, ownerId))
        .orderBy(teams.createdAt);
      const members = await loadMembers(
        db,
        rows.map((row) => row.id),
      );
      return rows.map((row) => toTeam(row, members.get(row.id) ?? []));
    },

    async create(ownerId, input) {
      const id = crypto.randomUUID();
      const result = await db.transaction(async (tx) => {
        const [total] = await tx
          .select({ value: count() })
          .from(teams)
          .where(eq(teams.ownerId, ownerId));
        if ((total?.value ?? 0) >= MAX_TEAMS_PER_USER) return "limit" as const;
        if (!(await ownsAll(tx, ownerId, input.members))) return "unknown_profile" as const;
        await tx.insert(teams).values({ id, ownerId, name: input.name });
        await writeMembers(tx, id, input.members);
        return "created" as const;
      });
      if (result !== "created") return result;
      const team = await loadOne(db, ownerId, id);
      if (!team) throw new Error("作成したチームを読み込めませんでした");
      return team;
    },

    async update(ownerId, id, patch) {
      return db.transaction(async (tx) => {
        if (!(await loadOne(tx, ownerId, id))) return null;
        if (patch.members && !(await ownsAll(tx, ownerId, patch.members))) {
          return "unknown_profile" as const;
        }
        if (patch.name !== undefined) {
          await tx.update(teams).set({ name: patch.name }).where(eq(teams.id, id));
        }
        if (patch.members) await writeMembers(tx, id, patch.members);
        return loadOne(tx, ownerId, id);
      });
    },

    async remove(ownerId, id) {
      const [result] = await db
        .delete(teams)
        .where(and(eq(teams.id, id), eq(teams.ownerId, ownerId)));
      return result.affectedRows > 0;
    },
  };
}
