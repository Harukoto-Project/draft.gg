/** 推薦パネル(インスペクター)の開閉と幅。ローカルに保存する */
export interface InspectorLayout {
  open: boolean;
  /** px */
  width: number;
}

export const INSPECTOR_MIN_WIDTH = 300;
export const INSPECTOR_MAX_WIDTH = 560;
export const DEFAULT_INSPECTOR_LAYOUT: InspectorLayout = { open: true, width: 340 };

const STORAGE_KEY = "draftgg.inspector.v1";
const LAYOUT_EVENT = "draftgg-inspector";

let cache: InspectorLayout = DEFAULT_INSPECTOR_LAYOUT;
let cacheRaw: string | null = null;

export function clampInspectorWidth(width: number): number {
  return Math.min(INSPECTOR_MAX_WIDTH, Math.max(INSPECTOR_MIN_WIDTH, Math.round(width)));
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): InspectorLayout {
  if (!raw) return DEFAULT_INSPECTOR_LAYOUT;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return DEFAULT_INSPECTOR_LAYOUT;
    const { open, width } = value as Record<string, unknown>;
    return {
      open: typeof open === "boolean" ? open : DEFAULT_INSPECTOR_LAYOUT.open,
      width:
        typeof width === "number" ? clampInspectorWidth(width) : DEFAULT_INSPECTOR_LAYOUT.width,
    };
  } catch {
    return DEFAULT_INSPECTOR_LAYOUT;
  }
}

export function subscribeInspectorLayout(onStoreChange: () => void): () => void {
  window.addEventListener(LAYOUT_EVENT, onStoreChange);
  return () => window.removeEventListener(LAYOUT_EVENT, onStoreChange);
}

export function getInspectorLayout(): InspectorLayout {
  const raw = readRaw();
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  cache = parse(raw);
  return cache;
}

export function writeInspectorLayout(next: InspectorLayout): void {
  cache = next;
  try {
    const raw = JSON.stringify(next);
    localStorage.setItem(STORAGE_KEY, raw);
    cacheRaw = raw;
  } catch {
    // 保存できなくても、この起動中は反映する
    cacheRaw = readRaw();
  }
  window.dispatchEvent(new Event(LAYOUT_EVENT));
}
