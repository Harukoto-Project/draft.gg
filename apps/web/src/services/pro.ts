import { proChampionsResponseSchema } from "@draftgg/shared";
import type { ProChampionsResponse, ProLeague } from "@draftgg/shared";

export async function loadProChampions(
  query: { league?: ProLeague; patch?: string },
  signal?: AbortSignal,
): Promise<ProChampionsResponse> {
  const params = new URLSearchParams();
  if (query.league) params.set("league", query.league);
  if (query.patch) params.set("patch", query.patch);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  const response = await fetch(`/api/pro/champions${suffix}`, { signal });
  if (!response.ok) {
    throw new Error("pro_unavailable");
  }

  const body: unknown = await response.json();
  return proChampionsResponseSchema.parse(body);
}
