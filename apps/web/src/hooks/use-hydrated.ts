import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => {};
}

/** サーバー描画とハイドレーション中は false。その後のクライアント描画で true。 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
