import {
  actionsMatchRules,
  savedDraftInputSchema,
  savedDraftSchema,
  savedDraftsResponseSchema,
} from "@draftgg/shared";
import type { DraftStore } from "@draftgg/db";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";

import type { AuthGateway } from "../mod/auth/index.js";
import { requireUser } from "../mod/auth/middleware.js";
import type { AuthEnv } from "../mod/auth/middleware.js";

export interface DraftsDeps {
  auth: AuthGateway | null;
  store: DraftStore;
}

/** ドラフト状態(20手 + ロール割り当て)で数KB。余裕を見て 16KB までにする */
export const MAX_DRAFT_BODY_BYTES = 16 * 1024;

const idSchema = z.uuid();

export function createDraftsRoute(deps: DraftsDeps) {
  const limit = bodyLimit({
    maxSize: MAX_DRAFT_BODY_BYTES,
    onError: (c) => c.json({ error: "payload_too_large" }, 413),
  });

  return new Hono<AuthEnv>()
    .use("*", requireUser(deps.auth))
    .use("*", async (c, next) => {
      c.header("Cache-Control", "no-store");
      await next();
    })

    .get("/", async (c) => {
      const drafts = await deps.store.list(c.get("user").id);
      return c.json(savedDraftsResponseSchema.parse({ drafts }));
    })

    .post("/", limit, async (c) => {
      const parsed = savedDraftInputSchema.safeParse(await c.req.json().catch(() => null));
      // 形だけでなく、進行ルールと手順が一致する状態だけを保存する
      if (!parsed.success || !actionsMatchRules(parsed.data.state)) {
        return c.json({ error: "invalid_request" }, 400);
      }
      const created = await deps.store.create(c.get("user").id, parsed.data);
      if (created === "limit") return c.json({ error: "draft_limit" }, 409);
      return c.json(savedDraftSchema.parse(created), 201);
    })

    .delete("/:id", async (c) => {
      const id = idSchema.safeParse(c.req.param("id"));
      if (!id.success) return c.json({ error: "not_found" }, 404);
      const removed = await deps.store.remove(c.get("user").id, id.data);
      if (!removed) return c.json({ error: "not_found" }, 404);
      return c.body(null, 204);
    });
}
