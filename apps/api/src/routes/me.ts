import { Hono } from "hono";

import type { AuthGateway } from "../mod/auth/index.js";

/**
 * `GET /api/me`。ログイン状態を返す。未ログインでもエラーにはしない。
 * ユーザーごとに内容が変わるのでキャッシュさせない。
 */
export function createMeRoute(gateway: AuthGateway | null) {
  return new Hono().get("/", async (c) => {
    const user = gateway ? await gateway.getUser(c.req.raw.headers) : null;
    c.header("Cache-Control", "no-store");
    return c.json({ loginEnabled: gateway !== null, user });
  });
}
