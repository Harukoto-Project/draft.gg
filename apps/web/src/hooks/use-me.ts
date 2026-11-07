import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { loadMe, signInWithDiscord, signOut } from "@/services/auth";

const ME_KEY = ["me"] as const;

/** ログイン中のユーザー固有のデータ(プール・チーム・保存ドラフト、それらを反映した提案)のキー */
const USER_DATA_KEYS = ["profiles", "teams", "drafts", "recommendations"] as const;

/** ログイン状態。未ログインや認証無効でも成功として返る */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: ({ signal }) => loadMe(signal),
    staleTime: 60 * 1000,
  });
}

export function useSignIn() {
  return useMutation({
    mutationFn: (callbackPath: string) => signInWithDiscord(callbackPath),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      // ユーザー固有のデータをキャッシュごと捨てる。
      // invalidateQueries は無効(enabled: false)なクエリを取り直さず、前のユーザーのデータが残るため
      // チャンピオン一覧や統計などの公開データは残す
      queryClient.removeQueries({
        predicate: (query) => USER_DATA_KEYS.some((key) => query.queryKey[0] === key),
      });
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}
