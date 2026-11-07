import { Hono } from "hono";
import { createFactory } from "hono/factory";

import type { AuthGateway } from "../mod/auth/index.js";

/**
 * `/api/auth/*`。Discord ログインのリダイレクトやサインアウトなどを Better Auth に任せる。
 * 認証が無効のときは 503 を返す(画面側は `/api/me` の `loginEnabled` でログイン導線を隠す)。
 */
export function createAuthRoute(gateway: AuthGateway | null) {
  const handlers = createFactory().createHandlers(async (c) => {
    if (!gateway) return c.json({ error: "auth_disabled" }, 503);
    return await gateway.handler(c.req.raw);
  });
  return new Hono().get("/*", ...handlers).post("/*", ...handlers);
}
