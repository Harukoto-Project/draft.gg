import type { PoolEntry, Profile, ProfileInput, ProfilePatch } from "@draftgg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { TEAMS_KEY } from "@/hooks/use-teams";
import {
  createProfile,
  deleteProfile,
  loadProfiles,
  replacePool,
  updateProfile,
} from "@/services/profiles";
import { syncProfilePool } from "@/services/pool-sync";

export const PROFILES_KEY = ["profiles"] as const;

/** ローカルに保存したプレイヤー一覧 */
export function useProfiles(enabled = true) {
  return useQuery({
    queryKey: PROFILES_KEY,
    queryFn: loadProfiles,
    enabled,
    staleTime: 60 * 1000,
  });
}

/** 応答で返った 1 件を、一覧のキャッシュへ反映する */
function useCacheUpsert() {
  const queryClient = useQueryClient();
  return (profile: Profile) => {
    queryClient.setQueryData<Profile[]>(PROFILES_KEY, (current) => {
      if (!current) return [profile];
      return current.some((item) => item.id === profile.id)
        ? current.map((item) => (item.id === profile.id ? profile : item))
        : [...current, profile];
    });
  };
}

export function useCreateProfile() {
  const upsert = useCacheUpsert();
  return useMutation({
    mutationFn: (input: ProfileInput) => createProfile(input),
    onSuccess: upsert,
  });
}

export function useUpdateProfile() {
  const upsert = useCacheUpsert();
  return useMutation({
    mutationFn: (variables: { id: string; patch: ProfilePatch }) =>
      updateProfile(variables.id, variables.patch),
    onSuccess: upsert,
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProfile(id),
    onSuccess: async (_result, id) => {
      queryClient.setQueryData<Profile[]>(PROFILES_KEY, (current) =>
        current?.filter((item) => item.id !== id),
      );
      // チームの割り当ても一緒に消えるので、チームを取り直す
      await queryClient.invalidateQueries({ queryKey: TEAMS_KEY });
    },
  });
}

export function useReplacePool() {
  const upsert = useCacheUpsert();
  return useMutation({
    mutationFn: (variables: { id: string; entries: PoolEntry[] }) =>
      replacePool(variables.id, variables.entries),
    onSuccess: upsert,
  });
}

/** OP.GG から取り込んで、プールへ反映する */
export function useSyncPool() {
  const upsert = useCacheUpsert();
  return useMutation({
    mutationFn: (profile: Profile) => syncProfilePool(profile),
    onSuccess: upsert,
  });
}
