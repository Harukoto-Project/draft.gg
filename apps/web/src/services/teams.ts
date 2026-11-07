import { teamSchema, teamsResponseSchema } from "@draftgg/shared";
import type { Team, TeamInput, TeamPatch } from "@draftgg/shared";

import { jsonInit, request } from "@/services/http";

const BASE_PATH = "/api/me/teams";

export async function loadTeams(signal?: AbortSignal): Promise<Team[]> {
  const response = await request(BASE_PATH, { signal });
  return teamsResponseSchema.parse(await response.json()).teams;
}

export async function createTeam(input: TeamInput): Promise<Team> {
  const response = await request(BASE_PATH, jsonInit("POST", input));
  return teamSchema.parse(await response.json());
}

export async function updateTeam(id: string, patch: TeamPatch): Promise<Team> {
  const response = await request(`${BASE_PATH}/${id}`, jsonInit("PATCH", patch));
  return teamSchema.parse(await response.json());
}

export async function deleteTeam(id: string): Promise<void> {
  await request(`${BASE_PATH}/${id}`, { method: "DELETE" });
}
