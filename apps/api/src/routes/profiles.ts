import {
  POOL_SYNC_INTERVAL_MS,
  poolUpdateSchema,
  profileInputSchema,
  profilePatchSchema,
  profileSchema,
  profilesResponseSchema,
} from "@draftgg/shared";
import type { ProfileStore } from "@draftgg/db";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";

import type { AuthGateway } from "../mod/auth/index.js";
import { requireUser } from "../mod/auth/middleware.js";
import type { AuthEnv } from "../mod/auth/middleware.js";
import { PoolSyncError } from "../mod/pool-sync/index.js";
import type { PoolSync } from "../mod/pool-sync/index.js";

export interface ProfilesDeps {
  auth: AuthGateway | null;
  store: ProfileStore;
  sync: PoolSync;
  /** テストで時刻を固定する */
  now?: () => Date;
}

/** プール 100 件で 15KB 程度。余裕を見て 32KB までにする */
export const MAX_PROFILE_BODY_BYTES = 32 * 1024;

const idSchema = z.uuid();

/** 同じプレイヤーへの同期の試行(成功・失敗を問わず)の最短間隔 */
const PROFILE_ATTEMPT_INTERVAL_MS = 60 * 1000;
/** 同じユーザーの、プレイヤーをまたいだ試行の最短間隔 */
const USER_ATTEMPT_INTERVAL_MS = 10 * 1000;
/** 記録がこの件数を超えたら、間隔を過ぎたものを捨てる */
const ATTEMPT_LOG_PRUNE_SIZE = 1000;

/** 試行の時刻をメモリに持つ。プロセスを再起動すると消えるが、同期の最短間隔は DB の syncedAt でも守る */
function createAttemptLog() {
  const lastAt = new Map<string, number>();
  return {
    remainingMs(key: string, intervalMs: number, nowMs: number): number {
      const last = lastAt.get(key);
      return last === undefined ? 0 : Math.max(0, intervalMs - (nowMs - last));
    },
    record(key: string, nowMs: number): void {
      lastAt.set(key, nowMs);
      if (lastAt.size > ATTEMPT_LOG_PRUNE_SIZE) {
        for (const [entryKey, at] of lastAt) {
          if (nowMs - at > POOL_SYNC_INTERVAL_MS) lastAt.delete(entryKey);
        }
      }
    },
  };
}

export function createProfilesRoute(deps: ProfilesDeps) {
  const now = deps.now ?? (() => new Date());
  const inFlight = new Set<string>();
  const attempts = createAttemptLog();
  const limit = bodyLimit({
    maxSize: MAX_PROFILE_BODY_BYTES,
    onError: (c) => c.json({ error: "payload_too_large" }, 413),
  });

  return new Hono<AuthEnv>()
    .use("*", requireUser(deps.auth))
    .use("*", async (c, next) => {
      c.header("Cache-Control", "no-store");
      await next();
    })

    .get("/", async (c) => {
      const profiles = await deps.store.list(c.get("user").id);
      return c.json(profilesResponseSchema.parse({ profiles }));
    })

    .post("/", limit, async (c) => {
      const parsed = profileInputSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
      const created = await deps.store.create(c.get("user").id, parsed.data);
      if (created === "limit") return c.json({ error: "profile_limit" }, 409);
      return c.json(profileSchema.parse(created), 201);
    })

    .patch("/:id", limit, async (c) => {
      const id = idSchema.safeParse(c.req.param("id"));
      const parsed = profilePatchSchema.safeParse(await c.req.json().catch(() => null));
      if (!id.success || !parsed.success) return c.json({ error: "invalid_request" }, 400);
      const updated = await deps.store.update(c.get("user").id, id.data, parsed.data);
      if (!updated) return c.json({ error: "not_found" }, 404);
      return c.json(profileSchema.parse(updated));
    })

    .delete("/:id", async (c) => {
      const id = idSchema.safeParse(c.req.param("id"));
      if (!id.success) return c.json({ error: "not_found" }, 404);
      const removed = await deps.store.remove(c.get("user").id, id.data);
      if (!removed) return c.json({ error: "not_found" }, 404);
      return c.body(null, 204);
    })

    .put("/:id/pool", limit, async (c) => {
      const id = idSchema.safeParse(c.req.param("id"));
      const parsed = poolUpdateSchema.safeParse(await c.req.json().catch(() => null));
      if (!id.success || !parsed.success) return c.json({ error: "invalid_request" }, 400);
      const result = await deps.store.replacePool(c.get("user").id, id.data, parsed.data.entries);
      if (result === "unknown_champion") return c.json({ error: "unknown_champion" }, 400);
      if (!result) return c.json({ error: "not_found" }, 404);
      return c.json(profileSchema.parse(result));
    })

    .post("/:id/sync", async (c) => {
      const id = idSchema.safeParse(c.req.param("id"));
      if (!id.success) return c.json({ error: "not_found" }, 404);
      const ownerId = c.get("user").id;
      const profile = await deps.store.get(ownerId, id.data);
      if (!profile) return c.json({ error: "not_found" }, 404);
      if (!profile.riotId || !profile.region) return c.json({ error: "riot_id_required" }, 400);

      if (profile.syncedAt) {
        const elapsed = now().getTime() - new Date(profile.syncedAt).getTime();
        if (elapsed < POOL_SYNC_INTERVAL_MS) {
          const retryAfter = Math.ceil((POOL_SYNC_INTERVAL_MS - elapsed) / 1000);
          c.header("Retry-After", String(retryAfter));
          return c.json({ error: "sync_too_soon", retryAfterSeconds: retryAfter }, 429);
        }
      }
      if (inFlight.has(profile.id)) return c.json({ error: "sync_in_progress" }, 409);

      // 失敗しても OP.GG を叩き続けないよう、試行そのものにも間隔を空ける
      const attemptAt = now().getTime();
      const wait = attempts.remainingMs(
        `profile:${profile.id}`,
        PROFILE_ATTEMPT_INTERVAL_MS,
        attemptAt,
      );
      const userWait = attempts.remainingMs(`user:${ownerId}`, USER_ATTEMPT_INTERVAL_MS, attemptAt);
      const retryMs = Math.max(wait, userWait);
      if (retryMs > 0) {
        const retryAfter = Math.ceil(retryMs / 1000);
        c.header("Retry-After", String(retryAfter));
        return c.json({ error: "sync_too_soon", retryAfterSeconds: retryAfter }, 429);
      }
      attempts.record(`profile:${profile.id}`, attemptAt);
      attempts.record(`user:${ownerId}`, attemptAt);

      inFlight.add(profile.id);
      try {
        const synced = await deps.sync.fetch({
          riotId: profile.riotId,
          region: profile.region,
          roles: profile.roles,
        });
        const updated = await deps.store.applySync(ownerId, profile.id, synced, now());
        if (!updated) return c.json({ error: "not_found" }, 404);
        return c.json(profileSchema.parse(updated));
      } catch (error) {
        if (error instanceof PoolSyncError) {
          if (error.code === "invalid_riot_id") return c.json({ error: "invalid_riot_id" }, 400);
          if (error.code === "busy") return c.json({ error: "busy" }, 429);
          return c.json({ error: "sync_failed" }, 502);
        }
        throw error;
      } finally {
        inFlight.delete(profile.id);
      }
    });
}
