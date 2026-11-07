import { teamInputSchema, teamPatchSchema, teamSchema, teamsResponseSchema } from "@draftgg/shared";
import type { TeamStore } from "@draftgg/db";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";

import type { AuthGateway } from "../mod/auth/index.js";
import { requireUser } from "../mod/auth/middleware.js";
import type { AuthEnv } from "../mod/auth/middleware.js";

export interface TeamsDeps {
  auth: AuthGateway | null;
  store: TeamStore;
}

/** 名前とロール 5 件の ID で 1KB 程度。余裕を見て 4KB までにする */
export const MAX_TEAM_BODY_BYTES = 4 * 1024;

const idSchema = z.uuid();

export function createTeamsRoute(deps: TeamsDeps) {
  const limit = bodyLimit({
    maxSize: MAX_TEAM_BODY_BYTES,
    onError: (c) => c.json({ error: "payload_too_large" }, 413),
  });

  return new Hono<AuthEnv>()
    .use("*", requireUser(deps.auth))
    .use("*", async (c, next) => {
      c.header("Cache-Control", "no-store");
      await next();
    })

    .get("/", async (c) => {
      const teams = await deps.store.list(c.get("user").id);
      return c.json(teamsResponseSchema.parse({ teams }));
    })

    .post("/", limit, async (c) => {
      const parsed = teamInputSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
      const created = await deps.store.create(c.get("user").id, parsed.data);
      if (created === "limit") return c.json({ error: "team_limit" }, 409);
      if (created === "unknown_profile") return c.json({ error: "unknown_profile" }, 400);
      return c.json(teamSchema.parse(created), 201);
    })

    .patch("/:id", limit, async (c) => {
      const id = idSchema.safeParse(c.req.param("id"));
      const parsed = teamPatchSchema.safeParse(await c.req.json().catch(() => null));
      if (!id.success || !parsed.success) return c.json({ error: "invalid_request" }, 400);
      const updated = await deps.store.update(c.get("user").id, id.data, parsed.data);
      if (updated === "unknown_profile") return c.json({ error: "unknown_profile" }, 400);
      if (!updated) return c.json({ error: "not_found" }, 404);
      return c.json(teamSchema.parse(updated));
    })

    .delete("/:id", async (c) => {
      const id = idSchema.safeParse(c.req.param("id"));
      if (!id.success) return c.json({ error: "not_found" }, 404);
      const removed = await deps.store.remove(c.get("user").id, id.data);
      if (!removed) return c.json({ error: "not_found" }, 404);
      return c.body(null, 204);
    });
}
