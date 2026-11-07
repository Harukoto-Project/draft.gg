import type { DraftStore } from "@draftgg/db";
import { createEmptyDraft } from "@draftgg/shared";
import type { SavedDraft } from "@draftgg/shared";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { AuthGateway } from "../mod/auth/index.js";
import { createDraftsRoute } from "./drafts.js";

const OWNER = "owner-1";
const DRAFT_ID = "6f9619ff-8b86-4011-b42d-00c04fc964ff";
const NEW_ID = "7f9619ff-8b86-4011-b42d-00c04fc964ff";

const STATE = createEmptyDraft({ format: "ranked", mySide: "blue" });
const BASE: SavedDraft = {
  id: DRAFT_ID,
  state: STATE,
  note: "メモ",
  createdAt: "2026-11-07T00:00:00.000Z",
};

function auth(userId: string | null): AuthGateway {
  return {
    handler: async () => new Response(null),
    getUser: async () => (userId ? { id: userId, name: "n", image: null } : null),
  };
}

function storeOf(drafts: SavedDraft[]): DraftStore {
  const byId = new Map(drafts.map((draft) => [draft.id, draft]));
  return {
    list: vi.fn(async () => [...byId.values()]),
    create: vi.fn(async (_owner, input) => ({
      id: NEW_ID,
      state: input.state,
      note: input.note ?? "",
      createdAt: "2026-11-07T01:00:00.000Z",
    })),
    remove: vi.fn(async (_owner, id) => byId.delete(id)),
  };
}

function appWith(options: { store?: DraftStore; userId?: string | null } = {}) {
  const store = options.store ?? storeOf([BASE]);
  const userId = options.userId === undefined ? OWNER : options.userId;
  const app = new Hono().route("/me/drafts", createDraftsRoute({ auth: auth(userId), store }));
  return { app, store };
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("認証", () => {
  it("未ログインなら全エンドポイントが 401", async () => {
    const { app } = appWith({ userId: null });
    expect((await app.request("/me/drafts")).status).toBe(401);
    expect((await app.request("/me/drafts", json("POST", {}))).status).toBe(401);
    expect((await app.request(`/me/drafts/${DRAFT_ID}`, { method: "DELETE" })).status).toBe(401);
  });

  it("操作は常にログイン中のユーザーの ID で行う", async () => {
    const { app, store } = appWith();
    await app.request(`/me/drafts/${DRAFT_ID}`, { method: "DELETE" });
    expect(store.remove).toHaveBeenCalledWith(OWNER, DRAFT_ID);
  });
});

describe("GET /me/drafts", () => {
  it("一覧を返し、キャッシュさせない", async () => {
    const { app } = appWith();
    const response = await app.request("/me/drafts");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ drafts: [BASE] });
  });
});

describe("POST /me/drafts", () => {
  it("ドラフトを保存して 201", async () => {
    const { app, store } = appWith();
    const response = await app.request(
      "/me/drafts",
      json("POST", { state: STATE, note: " 反省 " }),
    );
    expect(response.status).toBe(201);
    expect(store.create).toHaveBeenCalledWith(OWNER, { state: STATE, note: "反省" });
    expect(((await response.json()) as SavedDraft).id).toBe(NEW_ID);
  });

  it("メモは省略できる", async () => {
    const { app, store } = appWith();
    await app.request("/me/drafts", json("POST", { state: STATE }));
    expect(store.create).toHaveBeenCalledWith(OWNER, { state: STATE, note: "" });
  });

  it("ドラフト状態の形が違えば 400", async () => {
    const { app, store } = appWith();
    const response = await app.request(
      "/me/drafts",
      json("POST", { state: { ...STATE, format: "fearless" } }),
    );
    expect(response.status).toBe(400);
    expect(store.create).not.toHaveBeenCalled();
  });

  it("進行ルールと手順が合わない状態は 400", async () => {
    const { app, store } = appWith();
    const response = await app.request(
      "/me/drafts",
      json("POST", { state: { ...STATE, actions: STATE.actions.slice(0, 3) } }),
    );
    expect(response.status).toBe(400);
    expect(store.create).not.toHaveBeenCalled();
  });

  it("メモが長すぎれば 400", async () => {
    const { app } = appWith();
    const response = await app.request(
      "/me/drafts",
      json("POST", { state: STATE, note: "あ".repeat(201) }),
    );
    expect(response.status).toBe(400);
  });

  it("上限なら 409", async () => {
    const store = storeOf([]);
    store.create = vi.fn(async () => "limit" as const);
    const { app } = appWith({ store });
    const response = await app.request("/me/drafts", json("POST", { state: STATE }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "draft_limit" });
  });

  it("大きすぎる本文は 413", async () => {
    const { app } = appWith();
    const response = await app.request(
      "/me/drafts",
      json("POST", { state: STATE, note: "a".repeat(20 * 1024) }),
    );
    expect(response.status).toBe(413);
  });
});

describe("DELETE /me/drafts/:id", () => {
  it("削除して 204", async () => {
    const { app } = appWith();
    const response = await app.request(`/me/drafts/${DRAFT_ID}`, { method: "DELETE" });
    expect(response.status).toBe(204);
  });

  it("無ければ 404", async () => {
    const { app } = appWith();
    const response = await app.request(`/me/drafts/${NEW_ID}`, { method: "DELETE" });
    expect(response.status).toBe(404);
  });

  it("ID の形が違えば 404", async () => {
    const { app, store } = appWith();
    const response = await app.request("/me/drafts/abc", { method: "DELETE" });
    expect(response.status).toBe(404);
    expect(store.remove).not.toHaveBeenCalled();
  });
});
