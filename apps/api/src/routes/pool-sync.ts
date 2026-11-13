import { RIOT_REGIONS, POSITIONS, parseRiotId } from "@draftgg/shared";
import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";

import { PoolSyncError } from "../mod/pool-sync/index.js";
import type { PoolSync } from "../mod/pool-sync/index.js";
import { createRateLimiter } from "../mod/rate-limit/index.js";

export interface PoolSyncRouteDeps {
  sync: PoolSync;
  /** テストで時刻を固定する */
  now?: () => number;
}

/** 本文は Riot ID・地域・ロールだけ。1KB あれば十分 */
export const MAX_POOL_SYNC_BODY_BYTES = 1024;

/** 同じ IP が、同じ Riot ID を取り直せる最短間隔 */
const TARGET_INTERVAL_MS = 60 * 1000;
/** 同じ IP が OP.GG への取得を頼める回数(10 分あたり) */
const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_MAX_SYNCS = 10;

const requestSchema = z.object({
  riotId: z
    .string()
    .trim()
    .max(64)
    .refine((value) => parseRiotId(value) !== null),
  region: z.enum(RIOT_REGIONS),
  roles: z
    .array(z.enum(POSITIONS))
    .max(POSITIONS.length)
    .refine((roles) => new Set(roles).size === roles.length)
    .default([]),
});

/**
 * Cloudflare の接続元 IP を優先する。無ければ x-forwarded-for の先頭。
 * リバースプロキシ配下で動かすときは、プロキシがこのヘッダーを上書きすることが前提。
 */
function clientKey(c: Context): string {
  const cloudflare = c.req.header("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

function tooSoon(c: Context, retryAfterSeconds: number) {
  c.header("Retry-After", String(retryAfterSeconds));
  return c.json({ error: "sync_too_soon", retryAfterSeconds }, 429);
}

/** ログイン無しの公開エンドポイント。デスクトップアプリが、プールの候補を OP.GG から取るのに使う */
export function createPoolSyncRoute(deps: PoolSyncRouteDeps) {
  const now = deps.now;
  const perIp = createRateLimiter({ windowMs: IP_WINDOW_MS, max: IP_MAX_SYNCS, now });
  const perTarget = createRateLimiter({ windowMs: TARGET_INTERVAL_MS, max: 1, now });

  return new Hono().post(
    "/",
    bodyLimit({
      maxSize: MAX_POOL_SYNC_BODY_BYTES,
      onError: (c) => c.json({ error: "payload_too_large" }, 413),
    }),
    async (c) => {
      c.header("Cache-Control", "no-store");
      const parsed = requestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
      const input = parsed.data;

      const ip = clientKey(c);
      const ipWait = perIp.take(ip);
      if (ipWait > 0) return tooSoon(c, ipWait);
      const targetWait = perTarget.take(`${ip}|${input.region}|${input.riotId.toLowerCase()}`);
      if (targetWait > 0) return tooSoon(c, targetWait);

      try {
        const entries = await deps.sync.fetch(input);
        return c.json({ entries });
      } catch (error) {
        if (error instanceof PoolSyncError) {
          if (error.code === "invalid_riot_id") return c.json({ error: "invalid_riot_id" }, 400);
          if (error.code === "busy") return c.json({ error: "busy" }, 429);
        }
        console.log(JSON.stringify({ level: "error", msg: "pool sync failed" }));
        return c.json({ error: "sync_failed" }, 502);
      }
    },
  );
}
