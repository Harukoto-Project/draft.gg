import type { PoolEntry, Profile, ProfileInput, ProfilePatch } from "@draftgg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProfile,
  deleteProfile,
  loadProfiles,
  replacePool,
  syncProfile,
  updateProfile,
} from "@/services/profiles";

export const PROFILES_KEY = ["profiles"] as const;

/** ログイン中のユーザーのプレイヤー一覧。未ログインのときは取りに行かない */
export function useProfiles(enabled: boolean) {
  return useQuery({
    queryKey: PROFILES_KEY,
    queryFn: ({ signal }) => loadProfiles(signal),
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
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Profile[]>(PROFILES_KEY, (current) =>
        current?.filter((item) => item.id !== id),
      );
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

export function useSyncProfile() {
  const upsert = useCacheUpsert();
  return useMutation({
    mutationFn: (id: string) => syncProfile(id),
    onSuccess: upsert,
  });
}
