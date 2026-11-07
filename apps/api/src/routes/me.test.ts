import { meResponseSchema } from "@draftgg/shared";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { AuthGateway } from "../mod/auth/index.js";
import { requireUser } from "../mod/auth/middleware.js";
import type { AuthEnv } from "../mod/auth/middleware.js";
import { createAuthRoute } from "./auth.js";
import { createMeRoute } from "./me.js";

const USER = { id: "u1", name: "Harukoto", image: null };

function gatewayOf(user: typeof USER | null): AuthGateway {
  return {
    handler: vi.fn(async () => new Response("handled", { status: 200 })),
    getUser: vi.fn(async () => user),
  };
}

describe("GET /me", () => {
  it("ログイン中ならユーザーを返す", async () => {
    const app = new Hono().route("/me", createMeRoute(gatewayOf(USER)));
    const response = await app.request("/me");
    const body = meResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({ loginEnabled: true, user: USER });
  });

  it("未ログインでも 200 で user を null にする", async () => {
    const app = new Hono().route("/me", createMeRoute(gatewayOf(null)));
    const body = meResponseSchema.parse(await (await app.request("/me")).json());
    expect(body).toEqual({ loginEnabled: true, user: null });
  });

  it("認証が無効なら loginEnabled を false にする", async () => {
    const app = new Hono().route("/me", createMeRoute(null));
    const body = meResponseSchema.parse(await (await app.request("/me")).json());
    expect(body).toEqual({ loginEnabled: false, user: null });
  });
});

describe("/auth/*", () => {
  it("Better Auth にそのまま渡す", async () => {
    const gateway = gatewayOf(null);
    const app = new Hono().route("/auth", createAuthRoute(gateway));
    const response = await app.request("/auth/sign-out", { method: "POST" });

    expect(response.status).toBe(200);
    expect(gateway.handler).toHaveBeenCalledOnce();
  });

  it("認証が無効なら 503 を返す", async () => {
    const app = new Hono().route("/auth", createAuthRoute(null));
    const response = await app.request("/auth/sign-in/social", { method: "POST" });
    expect(response.status).toBe(503);
  });
});

describe("requireUser", () => {
  function appWith(gateway: AuthGateway | null) {
    return new Hono<AuthEnv>().get("/secret", requireUser(gateway), (c) =>
      c.json({ id: c.get("user").id }),
    );
  }

  it("ログイン中なら通し、user を渡す", async () => {
    const response = await appWith(gatewayOf(USER)).request("/secret");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "u1" });
  });

  it("未ログインなら 401 を返す", async () => {
    const response = await appWith(gatewayOf(null)).request("/secret");
    expect(response.status).toBe(401);
  });

  it("認証が無効なら 401 を返す", async () => {
    const response = await appWith(null).request("/secret");
    expect(response.status).toBe(401);
  });
});
