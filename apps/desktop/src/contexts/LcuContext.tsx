import { createContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { useChampions } from "@/hooks/use-champions";
import { getDraftSnapshot, writeDraft } from "@/services/draft-storage";
import { INITIAL_LCU_STATE, watchLcuState } from "@/services/lcu";
import type { LcuState } from "@/services/lcu";
import { championIdByKey, draftFromChampSelect } from "@/services/lcu-draft";

export interface LcuContextValue {
  state: LcuState;
  /** チャンピオンセレクト中。この間、盤面は LoL クライアントが決める(手動の編集は無効) */
  active: boolean;
}

export const LcuContext = createContext<LcuContextValue | null>(null);

/**
 * LoL クライアント(LCU)の状態を購読し、チャンピオンセレクト中は盤面をリアルタイムに更新する。
 * 画面(ページ)に関わらず動かすため、アプリ全体の上位に置く。
 */
export function LcuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LcuState>(INITIAL_LCU_STATE);
  const champions = useChampions();
  const idByKey = useMemo(() => championIdByKey(champions.data?.champions ?? []), [champions.data]);

  useEffect(() => watchLcuState(setState), []);

  useEffect(() => {
    // チャンピオン一覧が無いと、数値 ID を対応づけられない(届き次第、改めて反映される)
    if (state.status !== "champSelect" || idByKey.size === 0) return;
    const next = draftFromChampSelect(state.snapshot, idByKey);
    if (JSON.stringify(next) !== JSON.stringify(getDraftSnapshot())) writeDraft(next);
  }, [state, idByKey]);

  const value = useMemo<LcuContextValue>(
    () => ({ state, active: state.status === "champSelect" }),
    [state],
  );

  return <LcuContext.Provider value={value}>{children}</LcuContext.Provider>;
}
