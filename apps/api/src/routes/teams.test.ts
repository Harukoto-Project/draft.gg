import type { TeamStore } from "@draftgg/db";
import type { Team } from "@draftgg/shared";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { AuthGateway } from "../mod/auth/index.js";
import { createTeamsRoute } from "./teams.js";

const OWNER = "owner-1";
const TEAM_ID = "6f9619ff-8b86-4011-b42d-00c04fc964ff";
const OTHER_ID = "7f9619ff-8b86-4011-b42d-00c04fc964ff";
const PLAYER_A = "8f9619ff-8b86-4011-b42d-00c04fc964ff";
const PLAYER_B = "9f9619ff-8b86-4011-b42d-00c04fc964ff";

const BASE_TEAM: Team = { id: TEAM_ID, name: "Team A", members: { top: PLAYER_A } };

function auth(userId: string | null): AuthGateway {
  return {
    handler: async () => new Response(null),
    getUser: async () => (userId ? { id: userId, name: "n", image: null } : null),
  };
}

function storeOf(teams: Team[]): TeamStore {
  const byId = new Map(teams.map((team) => [team.id, team]));
  return {
    list: vi.fn(async () => [...byId.values()]),
    create: vi.fn(async (_owner, input) => ({ id: OTHER_ID, ...input })),
    update: vi.fn(async (_owner, id, patch) => {
      const current = byId.get(id);
      return current ? { ...current, ...patch } : null;
    }),
    remove: vi.fn(async (_owner, id) => byId.delete(id)),
  };
}

function appWith(options: { store?: TeamStore; userId?: string | null } = {}) {
  const store = options.store ?? storeOf([BASE_TEAM]);
  const userId = options.userId === undefined ? OWNER : options.userId;
  const app = new Hono().route("/me/teams", createTeamsRoute({ auth: auth(userId), store }));
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
    expect((await app.request("/me/teams")).status).toBe(401);
    expect((await app.request("/me/teams", json("POST", {}))).status).toBe(401);
    expect((await app.request(`/me/teams/${TEAM_ID}`, { method: "DELETE" })).status).toBe(401);
  });

  it("操作は常にログイン中のユーザーの ID で行う", async () => {
    const { app, store } = appWith();
    await app.request(`/me/teams/${TEAM_ID}`, json("PATCH", { name: "x" }));
    expect(store.update).toHaveBeenCalledWith(OWNER, TEAM_ID, { name: "x" });
  });
});

describe("GET /me/teams", () => {
  it("一覧を返し、キャッシュさせない", async () => {
    const { app } = appWith();
    const response = await app.request("/me/teams");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(((await response.json()) as { teams: Team[] }).teams).toEqual([BASE_TEAM]);
  });
});

describe("POST /me/teams", () => {
  const input = { name: " Team B ", members: { top: PLAYER_A, mid: PLAYER_B } };

  it("作成して 201 を返す(名前の前後の空白は取り除く)", async () => {
    const { app, store } = appWith();
    const response = await app.request("/me/teams", json("POST", input));
    expect(response.status).toBe(201);
    expect(store.create).toHaveBeenCalledWith(OWNER, { ...input, name: "Team B" });
  });

  it.each([
    { ...input, name: "" },
    { ...input, name: "a".repeat(51) },
    { ...input, members: { top: "not-a-uuid" } },
    { ...input, members: { top: PLAYER_A, mid: PLAYER_A } },
    { ...input, members: { coach: PLAYER_A } },
  ])("入力が不正なら 400", async (body) => {
    const { app, store } = appWith();
    expect((await app.request("/me/teams", json("POST", body))).status).toBe(400);
    expect(store.create).not.toHaveBeenCalled();
  });

  it("上限なら 409、他人のプレイヤーを含むなら 400", async () => {
    const store = storeOf([]);
    vi.mocked(store.create).mockResolvedValueOnce("limit").mockResolvedValueOnce("unknown_profile");
    const { app } = appWith({ store });
    expect((await app.request("/me/teams", json("POST", input))).status).toBe(409);
    const response = await app.request("/me/teams", json("POST", input));
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe("unknown_profile");
  });

  it("本文が大きすぎると 413", async () => {
    const { app } = appWith();
    const response = await app.request(
      "/me/teams",
      json("POST", { ...input, name: "a".repeat(5_000) }),
    );
    expect(response.status).toBe(413);
  });
});

describe("PATCH / DELETE", () => {
  it("名前だけ・ロール割り当てだけの更新ができる", async () => {
    const { app, store } = appWith();
    expect((await app.request(`/me/teams/${TEAM_ID}`, json("PATCH", { name: "B" }))).status).toBe(
      200,
    );
    expect(
      (await app.request(`/me/teams/${TEAM_ID}`, json("PATCH", { members: { mid: PLAYER_B } })))
        .status,
    ).toBe(200);
    expect(store.update).toHaveBeenLastCalledWith(OWNER, TEAM_ID, { members: { mid: PLAYER_B } });
  });

  it("存在しない(または他人の)チームは 404", async () => {
    const { app } = appWith();
    expect((await app.request(`/me/teams/${OTHER_ID}`, json("PATCH", { name: "B" }))).status).toBe(
      404,
    );
    expect((await app.request(`/me/teams/${OTHER_ID}`, { method: "DELETE" })).status).toBe(404);
  });

  it("他人のプレイヤーを割り当てると 400", async () => {
    const store = storeOf([BASE_TEAM]);
    vi.mocked(store.update).mockResolvedValueOnce("unknown_profile");
    const { app } = appWith({ store });
    const response = await app.request(
      `/me/teams/${TEAM_ID}`,
      json("PATCH", { members: { top: PLAYER_B } }),
    );
    expect(response.status).toBe(400);
  });

  it("ID の形が違えば 404(DELETE)・400(PATCH)", async () => {
    const { app } = appWith();
    expect((await app.request("/me/teams/abc", { method: "DELETE" })).status).toBe(404);
    expect((await app.request("/me/teams/abc", json("PATCH", {}))).status).toBe(400);
  });

  it("削除したら 204", async () => {
    const { app } = appWith();
    expect((await app.request(`/me/teams/${TEAM_ID}`, { method: "DELETE" })).status).toBe(204);
  });
});
