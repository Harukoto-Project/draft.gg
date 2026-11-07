import type { Champion, DraftState } from "@draftgg/shared";

export function actionChampionId(state: DraftState, step: number): string | null {
  return state.actions.find((action) => action.step === step)?.championId ?? null;
}

export function championFor(
  championsById: ReadonlyMap<string, Champion>,
  championId: string | null,
): Champion | null {
  if (!championId) return null;
  return championsById.get(championId) ?? null;
}
