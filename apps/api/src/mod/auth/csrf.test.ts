import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { requireSameOrigin } from "./csrf.js";

const ORIGIN = "https://draft.example.com";

function appOf(allowedOrigin: string | null) {
  return new Hono()
    .use("*", requireSameOrigin(allowedOrigin))
    .get("/x", (c) => c.json({ ok: true }))
    .post("/x", (c) => c.json({ ok: true }))
    .delete("/x", (c) => c.json({ ok: true }));
}

describe("requireSameOrigin", () => {
  it("GET は Origin が無くても通す", async () => {
    expect((await appOf(ORIGIN).request("/x")).status).toBe(200);
  });

  it("Origin が一致する変更系は通す", async () => {
    const res = await appOf(ORIGIN).request("/x", { method: "POST", headers: { origin: ORIGIN } });
    expect(res.status).toBe(200);
  });

  it("Origin が違う、または無い変更系は 403", async () => {
    const app = appOf(ORIGIN);
    const other = await app.request("/x", {
      method: "POST",
      headers: { origin: "https://evil.example.com" },
    });
    const none = await app.request("/x", { method: "DELETE" });
    expect(other.status).toBe(403);
    expect(none.status).toBe(403);
  });

  it("許可する Origin が無い(認証が無効)ときは確認しない", async () => {
    expect((await appOf(null).request("/x", { method: "POST" })).status).toBe(200);
  });
});
