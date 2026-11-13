import { teamSchema, teamsResponseSchema } from "@draftgg/shared";
import type { Team, TeamInput, TeamPatch } from "@draftgg/shared";

import { callCommand } from "@/services/tauri";

export async function loadTeams(): Promise<Team[]> {
  const teams = await callCommand<unknown>("list_teams");
  return teamsResponseSchema.parse({ teams }).teams;
}

export async function createTeam(input: TeamInput): Promise<Team> {
  return teamSchema.parse(await callCommand("create_team", { input }));
}

export async function updateTeam(id: string, patch: TeamPatch): Promise<Team> {
  return teamSchema.parse(await callCommand("update_team", { id, patch }));
}

export async function deleteTeam(id: string): Promise<void> {
  await callCommand("delete_team", { id });
}
