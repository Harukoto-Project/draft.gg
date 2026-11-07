"use client";

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
import {
  getDraftSnapshot,
  getServerDraft,
  subscribeDraft,
  writeDraft,
} from "@/services/draft-storage";

export interface DraftContextValue {
  ready: boolean;
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
  reset: () => void;
}

export const DraftContext = createContext<DraftContextValue | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const ready = useHydrated();
  const state = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getServerDraft);
  /** ユーザーが選んだ枠。形式を覚えておき、別タブで形式が変わったら無効にする */
  const [selection, setSelection] = useState<{ step: number | null; format: DraftFormat } | null>(
    null,
  );
  const activeStep =
    selection && selection.format === state.format ? selection.step : nextSuggestedStep(state, -1);

  const value = useMemo<DraftContextValue>(
    () => ({
      ready,
      state,
      activeStep,
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
      reset: () => {
        writeDraft(createEmptyDraft({ format: state.format, mySide: state.mySide, me: state.me }));
        setSelection(null);
      },
    }),
    [activeStep, ready, state],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}
