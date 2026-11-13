import { parseWeightOverrides } from "@/lib/weights";
import type { WeightOverrides } from "@/lib/weights";

const STORAGE_KEY = "draftgg.weights.v1";
const WEIGHTS_EVENT = "draftgg-weights";

const EMPTY: WeightOverrides = {};

let memory: WeightOverrides = EMPTY;
let memoryRaw: string | null = null;
let cachedRaw: string | null | undefined;

export function subscribeWeights(onStoreChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    onStoreChange();
  };
  window.addEventListener(WEIGHTS_EVENT, onStoreChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(WEIGHTS_EVENT, onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getWeightsSnapshot(): WeightOverrides {
  const raw = readRaw();
  if (raw === cachedRaw) return memory;
  cachedRaw = raw;
  memory = raw ? parseWeightOverrides(raw) : EMPTY;
  return memory;
}

export function getServerWeights(): WeightOverrides {
  return EMPTY;
}

export function writeWeights(overrides: WeightOverrides): void {
  const raw = Object.keys(overrides).length > 0 ? JSON.stringify(overrides) : null;
  memory = overrides;
  cachedRaw = raw;
  // 保存できないとき(容量不足やプライベートモード)は、画面上の設定だけを残す
  memoryRaw = raw;
  try {
    if (raw === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // memoryRaw に残してある
  }
  window.dispatchEvent(new Event(WEIGHTS_EVENT));
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}
