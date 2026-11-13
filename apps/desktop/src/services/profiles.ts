import { profileSchema, profilesResponseSchema } from "@draftgg/shared";
import type { PoolEntry, Profile, ProfileInput, ProfilePatch } from "@draftgg/shared";

import { callCommand } from "@/services/tauri";

// プレイヤーとプールは、アプリのデータフォルダに Rust が保存する。形は画面側でも検証する

export async function loadProfiles(): Promise<Profile[]> {
  const profiles = await callCommand<unknown>("list_profiles");
  return profilesResponseSchema.parse({ profiles }).profiles;
}

export async function createProfile(input: ProfileInput): Promise<Profile> {
  return profileSchema.parse(await callCommand("create_profile", { input }));
}

export async function updateProfile(id: string, patch: ProfilePatch): Promise<Profile> {
  return profileSchema.parse(await callCommand("update_profile", { id, patch }));
}

export async function deleteProfile(id: string): Promise<void> {
  await callCommand("delete_profile", { id });
}

export async function replacePool(id: string, entries: PoolEntry[]): Promise<Profile> {
  return profileSchema.parse(await callCommand("set_pool", { id, entries }));
}
