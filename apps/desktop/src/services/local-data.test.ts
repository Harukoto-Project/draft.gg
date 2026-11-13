import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { deleteDraft, loadDrafts, saveDraft } from "@/services/drafts";
import {
  createProfile,
  deleteProfile,
  loadProfiles,
  replacePool,
  updateProfile,
} from "@/services/profiles";
import { createTeam, deleteTeam, loadTeams, updateTeam } from "@/services/teams";

const ID = "11111111-1111-4111-8111-111111111111";
const profile = {
  id: ID,
  displayName: "たろう",
  riotId: null,
  region: null,
  roles: ["mid"],
  syncedAt: null,
  pool: [],
};
const team = { id: ID, name: "T", members: { top: ID } };
const empty = { top: null, jungle: null, mid: null, adc: null, support: null };
const draftState = {
  format: "ranked",
  mySide: "blue",
  actions: [],
  assignments: { blue: empty, red: empty },
};
const saved = { id: ID, state: draftState, note: "", createdAt: "2026-11-13T00:00:00.000Z" };

beforeEach(() => invoke.mockReset());

describe("プレイヤー", () => {
  it("一覧・作成・更新・削除・プール置き換えを、コマンドへ渡す", async () => {
    invoke.mockResolvedValueOnce([profile]);
    expect(await loadProfiles()).toEqual([profile]);
    expect(invoke).toHaveBeenLastCalledWith("list_profiles");

    const input = { displayName: "たろう", riotId: null, region: null, roles: ["mid" as const] };
    invoke.mockResolvedValueOnce(profile);
    await createProfile(input);
    expect(invoke).toHaveBeenLastCalledWith("create_profile", { input });

    invoke.mockResolvedValueOnce(profile);
    await updateProfile(ID, { riotId: null });
    expect(invoke).toHaveBeenLastCalledWith("update_profile", { id: ID, patch: { riotId: null } });

    invoke.mockResolvedValueOnce(profile);
    await replacePool(ID, []);
    expect(invoke).toHaveBeenLastCalledWith("set_pool", { id: ID, entries: [] });

    invoke.mockResolvedValueOnce(undefined);
    await deleteProfile(ID);
    expect(invoke).toHaveBeenLastCalledWith("delete_profile", { id: ID });
  });

  it("想定外の形の結果は失敗にする", async () => {
    invoke.mockResolvedValueOnce([{ id: 1 }]);
    await expect(loadProfiles()).rejects.toThrow();
  });

  it("コマンドのエラーコードを Error として投げる", async () => {
    invoke.mockRejectedValueOnce("limit_reached");
    await expect(
      createProfile({ displayName: "a", riotId: null, region: null, roles: [] }),
    ).rejects.toThrow("limit_reached");
  });
});

describe("チーム", () => {
  it("一覧・作成・更新・削除をコマンドへ渡す", async () => {
    invoke.mockResolvedValueOnce([team]);
    expect(await loadTeams()).toEqual([team]);
    expect(invoke).toHaveBeenLastCalledWith("list_teams");

    invoke.mockResolvedValueOnce(team);
    await createTeam({ name: "T", members: { top: ID } });
    expect(invoke).toHaveBeenLastCalledWith("create_team", {
      input: { name: "T", members: { top: ID } },
    });

    invoke.mockResolvedValueOnce(team);
    await updateTeam(ID, { name: "U" });
    expect(invoke).toHaveBeenLastCalledWith("update_team", { id: ID, patch: { name: "U" } });

    invoke.mockResolvedValueOnce(undefined);
    await deleteTeam(ID);
    expect(invoke).toHaveBeenLastCalledWith("delete_team", { id: ID });
  });
});

describe("保存ドラフト", () => {
  it("一覧・保存・削除をコマンドへ渡す", async () => {
    invoke.mockResolvedValueOnce([saved]);
    expect(await loadDrafts()).toEqual([saved]);
    expect(invoke).toHaveBeenLastCalledWith("list_drafts");

    invoke.mockResolvedValueOnce(saved);
    await saveDraft({ state: draftState as never, note: "メモ" });
    expect(invoke).toHaveBeenLastCalledWith("save_draft", {
      input: { state: draftState, note: "メモ" },
    });

    invoke.mockResolvedValueOnce(undefined);
    await deleteDraft(ID);
    expect(invoke).toHaveBeenLastCalledWith("delete_draft", { id: ID });
  });
});
