import type { SessionUser } from "@draftgg/shared";
import { createMiddleware } from "hono/factory";

import type { AuthGateway } from "./index.js";

/** ログイン必須のルートが `c.get("user")` で使う Hono の型 */
export interface AuthEnv {
  Variables: { user: SessionUser };
}

/**
 * ログインしていないリクエストを 401 で弾き、通ったら `user` を詰める。
 * 認証が無効(gateway が null)のときは常に 401 にする。
 */
export function requireUser(gateway: AuthGateway | null) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const user = gateway ? await gateway.getUser(c.req.raw.headers) : null;
    if (!user) return c.json({ error: "unauthorized" }, 401);
    c.set("user", user);
    await next();
  });
}
