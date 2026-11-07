import type { Team, TeamInput, TeamPatch } from "@draftgg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createTeam, deleteTeam, loadTeams, updateTeam } from "@/services/teams";

export const TEAMS_KEY = ["teams"] as const;

/** ログイン中のユーザーのチーム一覧。未ログインのときは取りに行かない */
export function useTeams(enabled: boolean) {
  return useQuery({
    queryKey: TEAMS_KEY,
    queryFn: ({ signal }) => loadTeams(signal),
    enabled,
    staleTime: 60 * 1000,
  });
}

function useCacheUpsert() {
  const queryClient = useQueryClient();
  return (team: Team) => {
    queryClient.setQueryData<Team[]>(TEAMS_KEY, (current) => {
      if (!current) return [team];
      return current.some((item) => item.id === team.id)
        ? current.map((item) => (item.id === team.id ? team : item))
        : [...current, team];
    });
  };
}

export function useCreateTeam() {
  const upsert = useCacheUpsert();
  return useMutation({
    mutationFn: (input: TeamInput) => createTeam(input),
    onSuccess: upsert,
  });
}

export function useUpdateTeam() {
  const upsert = useCacheUpsert();
  return useMutation({
    mutationFn: (variables: { id: string; patch: TeamPatch }) =>
      updateTeam(variables.id, variables.patch),
    onSuccess: upsert,
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTeam(id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Team[]>(TEAMS_KEY, (current) =>
        current?.filter((item) => item.id !== id),
      );
    },
  });
}
