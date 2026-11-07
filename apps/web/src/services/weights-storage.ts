import { BAN_FACTORS, PICK_FACTORS } from "@draftgg/shared";

import { WEIGHT_MAX } from "@/lib/weights";
import type { PresetOverrides, WeightOverrides } from "@/lib/weights";

const STORAGE_KEY = "draftgg.weights.v1";
const WEIGHTS_EVENT = "draftgg-weights";
const PRESET_KEYS = ["solo", "team"] as const;

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
  memory = parse(raw);
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

function pickGroup(value: unknown, factors: readonly string[]): Record<string, number> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const result: Record<string, number> = {};
  for (const factor of factors) {
    const item = (value as Record<string, unknown>)[factor];
    if (typeof item === "number" && Number.isFinite(item) && item >= 0 && item <= WEIGHT_MAX) {
      result[factor] = item;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** 壊れた値や知らない要素は捨てる */
function parse(raw: string | null): WeightOverrides {
  if (!raw) return EMPTY;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (typeof data !== "object" || data === null) return EMPTY;

  const result: WeightOverrides = {};
  for (const preset of PRESET_KEYS) {
    const own = (data as Record<string, unknown>)[preset];
    if (typeof own !== "object" || own === null) continue;
    const pick = pickGroup((own as Record<string, unknown>).pick, PICK_FACTORS);
    const ban = pickGroup((own as Record<string, unknown>).ban, BAN_FACTORS);
    if (!pick && !ban) continue;
    result[preset] = {
      ...(pick ? { pick } : {}),
      ...(ban ? { ban } : {}),
    } as PresetOverrides;
  }
  return result;
}
