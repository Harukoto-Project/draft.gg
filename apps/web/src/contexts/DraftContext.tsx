"use client";

import {
  assignPickPosition,
  changeFormat,
  clearStep,
  createEmptyDraft,
  nextSuggestedStep,
  placeChampion,
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
  reset: () => void;
}

export const DraftContext = createContext<DraftContextValue | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const ready = useHydrated();
  const state = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getServerDraft);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [selectionOwned, setSelectionOwned] = useState(false);
  const activeStep = selectionOwned ? selectedStep : nextSuggestedStep(state, -1);

  const value = useMemo<DraftContextValue>(
    () => ({
      ready,
      state,
      activeStep,
      selectStep: (step) => {
        setSelectionOwned(true);
        setSelectedStep(step);
      },
      pickChampion: (championId) => {
        if (activeStep === null) return;
        const next = placeChampion(state, activeStep, championId);
        if (next === state) return;
        writeDraft(next);
        setSelectionOwned(true);
        setSelectedStep(nextSuggestedStep(next, activeStep));
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
        setSelectionOwned(false);
        setSelectedStep(null);
      },
      chooseSide: (side) => {
        const next = setMySide(state, side);
        if (next !== state) writeDraft(next);
      },
      reset: () => {
        writeDraft(createEmptyDraft({ format: state.format, mySide: state.mySide }));
        setSelectionOwned(false);
        setSelectedStep(null);
      },
    }),
    [activeStep, ready, state],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}
