import type { SavedDraft, SavedDraftInput } from "@draftgg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteDraft, loadDrafts, saveDraft } from "@/services/drafts";

export const DRAFTS_KEY = ["drafts"] as const;

/** ログイン中のユーザーが保存したドラフト(新しい順)。未ログインのときは取りに行かない */
export function useDrafts(enabled: boolean) {
  return useQuery({
    queryKey: DRAFTS_KEY,
    queryFn: ({ signal }) => loadDrafts(signal),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useSaveDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SavedDraftInput) => saveDraft(input),
    onSuccess: (saved) => {
      queryClient.setQueryData<SavedDraft[]>(DRAFTS_KEY, (current) =>
        current ? [saved, ...current] : [saved],
      );
    },
  });
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDraft(id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<SavedDraft[]>(DRAFTS_KEY, (current) =>
        current?.filter((item) => item.id !== id),
      );
    },
  });
}
