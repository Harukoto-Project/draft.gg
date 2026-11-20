import { createEmptyDraft, setMyPosition, sideTurns } from "@draftgg/shared";
import type { Champion, DraftState, Position, Side } from "@draftgg/shared";

import type { ChampSelectSnapshot } from "@/services/lcu";

/** BAN とピックに共通の 1 手。ロールはピックだけが持つ */
interface LcuEntry {
  side: Side;
  championKey: number | null;
  position?: Position | null;
}

/** Riot の数値 ID(LCU が使う)から、アプリのチャンピオン ID への対応 */
export function championIdByKey(champions: readonly Champion[]): ReadonlyMap<number, string> {
  return new Map(champions.map((champion) => [champion.numericKey, champion.id]));
}

/**
 * LCU のチャンピオンセレクトを、ドラフト盤面にする。盤面は LCU が決めるので、前の入力は引き継がない。
 * LCU の手順は、サイドごとの n 番目を、その形式の進行ルールの同じサイドの n 番目の枠に入れる。
 * 一覧にないチャンピオン(Data Dragon が追いついていない新チャンピオンなど)は、空の枠のままにする。
 */
export function draftFromChampSelect(
  snapshot: ChampSelectSnapshot,
  idByKey: ReadonlyMap<number, string>,
): DraftState {
  const draft = createEmptyDraft({ format: snapshot.format, mySide: snapshot.mySide });
  const filled = snapshot.myPosition ? setMyPosition(draft, snapshot.myPosition) : draft;

  const championIds = new Map<number, string | null>();
  const assignments = {
    blue: { ...filled.assignments.blue },
    red: { ...filled.assignments.red },
  };

  const groups: [type: "ban" | "pick", entries: readonly LcuEntry[]][] = [
    ["ban", snapshot.bans],
    ["pick", snapshot.picks],
  ];
  for (const [type, entries] of groups) {
    const seen: Record<Side, number> = { blue: 0, red: 0 };

    for (const entry of entries) {
      const turn = sideTurns(snapshot.format, entry.side, type)[seen[entry.side]];
      seen[entry.side] += 1;
      if (!turn || entry.championKey === null) continue;

      const championId = idByKey.get(entry.championKey) ?? null;
      championIds.set(turn.step, championId);
      if (type === "pick" && championId && entry.position) {
        assignments[entry.side][entry.position] = championId;
      }
    }
  }

  return {
    ...filled,
    actions: filled.actions.map((action) => ({
      ...action,
      championId: championIds.get(action.step) ?? null,
    })),
    assignments,
  };
}
