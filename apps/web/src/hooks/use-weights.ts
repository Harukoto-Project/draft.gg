"use client";

import { useSyncExternalStore } from "react";

import type { WeightOverrides } from "@/lib/weights";
import {
  getServerWeights,
  getWeightsSnapshot,
  subscribeWeights,
  writeWeights,
} from "@/services/weights-storage";

/** ブラウザに保存した重みの調整(プリセットから変えたものだけ) */
export function useWeightOverrides(): {
  overrides: WeightOverrides;
  setOverrides: (next: WeightOverrides) => void;
} {
  const overrides = useSyncExternalStore(subscribeWeights, getWeightsSnapshot, getServerWeights);
  return { overrides, setOverrides: writeWeights };
}
