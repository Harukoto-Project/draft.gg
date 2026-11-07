import { actionsMatchRules, createEmptyDraft, draftStateSchema } from "@draftgg/shared";
import type { DraftState } from "@draftgg/shared";

const STORAGE_KEY = "draftgg.draft.v1";
const DRAFT_EVENT = "draftgg-draft";

const INITIAL_DRAFT = createEmptyDraft({ format: "ranked", mySide: "blue" });

let memory: DraftState = INITIAL_DRAFT;
let memoryRaw: string | null = null;

export function subscribeDraft(onStoreChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    memoryRaw = null;
    onStoreChange();
  };
  window.addEventListener(DRAFT_EVENT, onStoreChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(DRAFT_EVENT, onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getDraftSnapshot(): DraftState {
  const raw = readRaw();
  if (raw === memoryRaw) return memory;

  memoryRaw = raw;
  memory = parseDraft(raw) ?? INITIAL_DRAFT;
  return memory;
}

export function getServerDraft(): DraftState {
  return INITIAL_DRAFT;
}

export function writeDraft(state: DraftState): void {
  memory = state;
  try {
    const raw = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, raw);
    memoryRaw = raw;
  } catch {
    // 容量不足やプライベートモードでは、画面上の入力だけを残す
    memoryRaw = readRaw();
  }
  window.dispatchEvent(new Event(DRAFT_EVENT));
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}

function parseDraft(raw: string | null): DraftState | null {
  if (!raw) return null;
  try {
    const body: unknown = JSON.parse(raw);
    const parsed = draftStateSchema.safeParse(body);
    if (!parsed.success || !actionsMatchRules(parsed.data)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
