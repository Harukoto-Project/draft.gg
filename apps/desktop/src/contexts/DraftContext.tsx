import {
  assignPickPosition,
  changeFormat,
  clearStep,
  createEmptyDraft,
  nextSuggestedStep,
  placeChampion,
  setMyPosition,
  setMySide,
} from "@draftgg/shared";
import type { DraftFormat, DraftState, Position, Side } from "@draftgg/shared";
import { createContext, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { useHydrated } from "@/hooks/use-hydrated";
import { useLcu } from "@/hooks/use-lcu";
import {
  getDraftSnapshot,
  getServerDraft,
  subscribeDraft,
  writeDraft,
} from "@/services/draft-storage";

export interface DraftContextValue {
  ready: boolean;
  /** LoL クライアントがチャンピオンセレクト中で、盤面を決めている間は true。手動の編集は何もしない */
  locked: boolean;
  state: DraftState;
  activeStep: number | null;
  selectStep: (step: number) => void;
  pickChampion: (championId: string) => void;
  clearActive: () => void;
  assignRole: (step: number, position: Position | null) => void;
  chooseFormat: (format: DraftFormat) => void;
  chooseSide: (side: Side) => void;
  /** 自分のロール。null でチーム向け(ロールを決めない) */
  chooseMyPosition: (position: Position | null) => void;
  /** 保存したドラフトを、いまのドラフトとして読み込む */
  loadDraft: (state: DraftState) => void;
  reset: () => void;
}

export const DraftContext = createContext<DraftContextValue | null>(null);

type DraftEditors = Omit<DraftContextValue, "ready" | "locked" | "state" | "activeStep">;

const noop = () => {};

const READ_ONLY_EDITORS: DraftEditors = {
  selectStep: noop,
  pickChampion: noop,
  clearActive: noop,
  assignRole: noop,
  chooseFormat: noop,
  chooseSide: noop,
  chooseMyPosition: noop,
  loadDraft: noop,
  reset: noop,
};

export function DraftProvider({ children }: { children: ReactNode }) {
  const ready = useHydrated();
  const state = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getServerDraft);
  /** ユーザーが選んだ枠。形式を覚えておき、別タブで形式が変わったら無効にする */
  const [selection, setSelection] = useState<{ step: number | null; format: DraftFormat } | null>(
    null,
  );
  const activeStep =
    selection && selection.format === state.format ? selection.step : nextSuggestedStep(state, -1);

  const { active: locked } = useLcu();

  const value = useMemo<DraftContextValue>(() => {
    const editors: DraftEditors = {
      selectStep: (step) => {
        setSelection({ step, format: state.format });
      },
      pickChampion: (championId) => {
        if (activeStep === null) return;
        const next = placeChampion(state, activeStep, championId);
        if (next === state) return;
        writeDraft(next);
        setSelection({ step: nextSuggestedStep(next, activeStep), format: next.format });
      },
      clearActive: () => {
        if (activeStep === null) return;
        const next = clearStep(state, activeStep);
        if (next !== state) writeDraft(next);
      },
      assignRole: (step, position) => {
        const next = assignPickPosition(state, step, position);
        if (next !== state) writeDraft(next);
      },
      chooseFormat: (format) => {
        const next = changeFormat(state, format);
        if (next !== state) writeDraft(next);
        setSelection(null);
      },
      chooseSide: (side) => {
        const next = setMySide(state, side);
        if (next !== state) writeDraft(next);
      },
      chooseMyPosition: (position) => {
        const next = setMyPosition(state, position);
        if (next !== state) writeDraft(next);
      },
      loadDraft: (next) => {
        writeDraft(next);
        setSelection(null);
      },
      reset: () => {
        writeDraft(createEmptyDraft({ format: state.format, mySide: state.mySide, me: state.me }));
        setSelection(null);
      },
    };
    // チャンピオンセレクト中は LoL クライアントが盤面を決めるので、編集は何もしない
    return { ready, locked, state, activeStep, ...(locked ? READ_ONLY_EDITORS : editors) };
  }, [activeStep, locked, ready, state]);

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}
