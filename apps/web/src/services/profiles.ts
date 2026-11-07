import { profileSchema, profilesResponseSchema } from "@draftgg/shared";
import type { PoolEntry, Profile, ProfileInput, ProfilePatch } from "@draftgg/shared";

import { jsonInit, request } from "@/services/http";

const BASE_PATH = "/api/me/profiles";

export async function loadProfiles(signal?: AbortSignal): Promise<Profile[]> {
  const response = await request(BASE_PATH, { signal });
  return profilesResponseSchema.parse(await response.json()).profiles;
}

export async function createProfile(input: ProfileInput): Promise<Profile> {
  const response = await request(BASE_PATH, jsonInit("POST", input));
  return profileSchema.parse(await response.json());
}

export async function updateProfile(id: string, patch: ProfilePatch): Promise<Profile> {
  const response = await request(`${BASE_PATH}/${id}`, jsonInit("PATCH", patch));
  return profileSchema.parse(await response.json());
}

export async function deleteProfile(id: string): Promise<void> {
  await request(`${BASE_PATH}/${id}`, { method: "DELETE" });
}

export async function replacePool(id: string, entries: PoolEntry[]): Promise<Profile> {
  const response = await request(`${BASE_PATH}/${id}/pool`, jsonInit("PUT", { entries }));
  return profileSchema.parse(await response.json());
}

export async function syncProfile(id: string): Promise<Profile> {
  const response = await request(`${BASE_PATH}/${id}/sync`, { method: "POST" });
  return profileSchema.parse(await response.json());
}
