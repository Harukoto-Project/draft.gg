import type { DraftFormat, Position, Side } from "@draftgg/shared";
import { listen } from "@tauri-apps/api/event";

import { isTauri } from "@/lib/platform";
import { callCommand } from "@/services/tauri";

/** Rust 側(`draftgg-lcu`)が送る LCU のチャンピオンセレクトの要約。形は Rust の `ChampSelectSnapshot` と揃える */
export interface ChampSelectSnapshot {
  format: DraftFormat;
  mySide: Side;
  myPosition: Position | null;
  /** LCU のフェーズ名(`BAN_PICK` など) */
  phase: string;
  /** LCU の手順の並び。サイドごとの順番を保つ */
  bans: { side: Side; championKey: number | null }[];
  picks: { side: Side; championKey: number | null; position: Position | null }[];
}

export type LcuState =
  /** クライアントが起動していない、または接続できない */
  | { status: "disconnected" }
  /** 接続済みで、チャンピオンセレクト中ではない */
  | { status: "idle" }
  /** チャンピオンセレクト中だが、ドラフトとして扱えない(観戦・ブラインドピックなど) */
  | { status: "unsupported" }
  | { status: "champSelect"; snapshot: ChampSelectSnapshot };

export const INITIAL_LCU_STATE: LcuState = { status: "disconnected" };

const LCU_STATE_EVENT = "lcu-state";

/**
 * LoL クライアントの状態を購読する。起動時の状態も 1 回届ける。戻り値は購読解除関数。
 * ブラウザでの開発時は、クライアントに繋がらないので何もしない
 */
export function watchLcuState(onState: (state: LcuState) => void): () => void {
  if (!isTauri) return () => {};

  let disposed = false;
  let received = false;
  let unlisten: (() => void) | null = null;

  // 先に購読してから初期値を読み、初期値がイベントより新しい状態を上書きしないようにする
  void listen<LcuState>(LCU_STATE_EVENT, (event) => {
    received = true;
    onState(event.payload);
  }).then((stop) => {
    if (disposed) {
      stop();
      return;
    }
    unlisten = stop;
    void callCommand<LcuState>("lcu_state")
      .then((state) => {
        if (!disposed && !received) onState(state);
      })
      .catch(() => {});
  });

  return () => {
    disposed = true;
    unlisten?.();
  };
}
