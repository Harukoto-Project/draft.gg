import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { loadMe, signInWithDiscord, signOut } from "@/services/auth";

const ME_KEY = ["me"] as const;

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
      // ログイン中のデータ(プール・チーム・保存したドラフト)をまとめて捨てる
      await queryClient.invalidateQueries();
    },
  });
}
