import type { DraftFormat, DraftState, Side } from "./draft.js";
import { POSITIONS } from "./position.js";
import type { Position } from "./position.js";

/** 進行ルールの1手。同じ phase の空枠は順不同で入力できる。 */
export interface DraftTurn {
  step: number;
  type: "ban" | "pick";
  side: Side;
  phase: number;
}

interface DraftSegment {
  type: "ban" | "pick";
  sides: readonly Side[];
  /** true のとき、この並び全体を1つの phase にする(ランク戦のBAN) */
  simultaneous: boolean;
}

const BLUE_BANS = ["blue", "blue", "blue", "blue", "blue"] as const satisfies readonly Side[];
const RED_BANS = ["red", "red", "red", "red", "red"] as const satisfies readonly Side[];

/** ランク戦のピック: B1 / R1 R2 / B2 B3 / R3 R4 / B4 B5 / R5 */
const RANKED_PICKS = [
  "blue",
  "red",
  "red",
  "blue",
  "blue",
  "red",
  "red",
  "blue",
  "blue",
  "red",
] as const satisfies readonly Side[];

/** 大会の第1BAN: B R B R B R */
const TOURNAMENT_FIRST_BANS = [
  "blue",
  "red",
  "blue",
  "red",
  "blue",
  "red",
] as const satisfies readonly Side[];
/** 大会の第1ピック: B1 / R1 R2 / B2 B3 / R3 */
const TOURNAMENT_FIRST_PICKS = [
  "blue",
  "red",
  "red",
  "blue",
  "blue",
  "red",
] as const satisfies readonly Side[];
/** 大会の第2BAN: R B R B */
const TOURNAMENT_SECOND_BANS = ["red", "blue", "red", "blue"] as const satisfies readonly Side[];
/** 大会の第2ピック: R4 / B4 B5 / R5 */
const TOURNAMENT_SECOND_PICKS = ["red", "blue", "blue", "red"] as const satisfies readonly Side[];

function buildTurns(segments: readonly DraftSegment[]): DraftTurn[] {
  const turns: DraftTurn[] = [];
  let phase = 0;

  for (const segment of segments) {
    if (segment.simultaneous) {
      for (const side of segment.sides) {
        turns.push({ step: turns.length, type: segment.type, side, phase });
      }
      phase += 1;
      continue;
    }

    for (const side of segment.sides) {
      turns.push({ step: turns.length, type: segment.type, side, phase });
      phase += 1;
    }
  }

  return turns;
}

const RANKED_TURNS = buildTurns([
  { type: "ban", sides: [...BLUE_BANS, ...RED_BANS], simultaneous: true },
  { type: "pick", sides: RANKED_PICKS, simultaneous: false },
]);

const TOURNAMENT_TURNS = buildTurns([
  { type: "ban", sides: TOURNAMENT_FIRST_BANS, simultaneous: false },
  { type: "pick", sides: TOURNAMENT_FIRST_PICKS, simultaneous: false },
  { type: "ban", sides: TOURNAMENT_SECOND_BANS, simultaneous: false },
  { type: "pick", sides: TOURNAMENT_SECOND_PICKS, simultaneous: false },
]);

const TURNS: Record<DraftFormat, readonly DraftTurn[]> = {
  ranked: RANKED_TURNS,
  tournament: TOURNAMENT_TURNS,
};

const EMPTY_ASSIGNMENT = {
  top: null,
  jungle: null,
  mid: null,
  adc: null,
  support: null,
} as const;

export function turnsFor(format: DraftFormat): readonly DraftTurn[] {
  return TURNS[format];
}

export function sideTurns(
  format: DraftFormat,
  side: Side,
  type: "ban" | "pick",
): readonly DraftTurn[] {
  return turnsFor(format).filter((turn) => turn.side === side && turn.type === type);
}

export function createEmptyDraft(input: {
  format: DraftFormat;
  mySide: Side;
  /** やり直しや形式変更でも、自分のロールは引き継ぐ */
  me?: DraftState["me"];
}): DraftState {
  return {
    format: input.format,
    mySide: input.mySide,
    ...(input.me ? { me: { side: input.mySide, position: input.me.position } } : {}),
    actions: turnsFor(input.format).map((turn) => ({
      step: turn.step,
      type: turn.type,
      side: turn.side,
      championId: null,
    })),
    assignments: {
      blue: { ...EMPTY_ASSIGNMENT },
      red: { ...EMPTY_ASSIGNMENT },
    },
  };
}

/** 保存済みの手順が、今の進行ルールと一致するか */
export function actionsMatchRules(state: DraftState): boolean {
  const turns = turnsFor(state.format);
  if (state.actions.length !== turns.length) return false;

  return turns.every((turn, index) => {
    const action = state.actions[index];
    return action?.step === turn.step && action.type === turn.type && action.side === turn.side;
  });
}

export function draftHasChampion(state: DraftState): boolean {
  return state.actions.some((action) => action.championId !== null);
}

export function championIdsInUse(state: DraftState): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const action of state.actions) {
    if (action.championId !== null) ids.add(action.championId);
  }
  return ids;
}

/** まだ空いている、いちばん早い phase の枠 */
export function suggestedSteps(state: DraftState): number[] {
  const turns = turnsFor(state.format);
  let phase: number | null = null;

  for (const turn of turns) {
    const action = state.actions.find((candidate) => candidate.step === turn.step);
    if (action?.championId === null) {
      phase = turn.phase;
      break;
    }
  }

  if (phase === null) return [];

  return turns
    .filter((turn) => turn.phase === phase)
    .filter(
      (turn) => state.actions.find((action) => action.step === turn.step)?.championId === null,
    )
    .map((turn) => turn.step);
}

/** 埋めた枠の次。同じ phase に後ろの空枠がなければ、残りの先頭に戻る */
export function nextSuggestedStep(state: DraftState, afterStep: number): number | null {
  const suggested = suggestedSteps(state);
  if (suggested.length === 0) return null;
  return suggested.find((step) => step > afterStep) ?? suggested[0] ?? null;
}

export function placeChampion(state: DraftState, step: number, championId: string): DraftState {
  const action = state.actions.find((candidate) => candidate.step === step);
  if (!action || action.championId === championId) return state;
  if (championIdsInUse(state).has(championId)) return state;

  let assignments = state.assignments;
  if (action.type === "pick" && action.championId) {
    const position = positionOf(assignments, action.side, action.championId);
    assignments = removeChampion(assignments, action.side, action.championId);
    if (position) {
      assignments = {
        ...assignments,
        [action.side]: { ...assignments[action.side], [position]: championId },
      };
    }
  }

  return {
    ...state,
    actions: state.actions.map((candidate) =>
      candidate.step === step ? { ...candidate, championId } : candidate,
    ),
    assignments,
  };
}

export function clearStep(state: DraftState, step: number): DraftState {
  const action = state.actions.find((candidate) => candidate.step === step);
  if (!action?.championId) return state;

  const championId = action.championId;
  return {
    ...state,
    actions: state.actions.map((candidate) =>
      candidate.step === step ? { ...candidate, championId: null } : candidate,
    ),
    assignments:
      action.type === "pick"
        ? removeChampion(state.assignments, action.side, championId)
        : state.assignments,
  };
}

export function assignPickPosition(
  state: DraftState,
  step: number,
  position: Position | null,
): DraftState {
  const action = state.actions.find((candidate) => candidate.step === step);
  if (!action || action.type !== "pick" || !action.championId) return state;

  const sideAssignment = { ...state.assignments[action.side] };
  for (const candidate of POSITIONS) {
    if (sideAssignment[candidate] === action.championId) sideAssignment[candidate] = null;
  }
  if (position) sideAssignment[position] = action.championId;

  return {
    ...state,
    assignments: { ...state.assignments, [action.side]: sideAssignment },
  };
}

export function setMySide(state: DraftState, mySide: Side): DraftState {
  if (state.mySide === mySide && (state.me === undefined || state.me.side === mySide)) return state;
  return {
    ...state,
    mySide,
    me: state.me ? { ...state.me, side: mySide } : undefined,
  };
}

/** 自分のロールを決める。null でチーム向け(ロールを決めない)に戻す */
export function setMyPosition(state: DraftState, position: Position | null): DraftState {
  if (position === null) {
    if (state.me === undefined) return state;
    const next = { ...state };
    delete next.me;
    return next;
  }
  if (state.me?.position === position && state.me.side === state.mySide) return state;
  return { ...state, me: { side: state.mySide, position } };
}

export function changeFormat(state: DraftState, format: DraftFormat): DraftState {
  if (state.format === format) return state;
  return createEmptyDraft({ format, mySide: state.mySide, me: state.me });
}

export function positionOfChampion(
  state: DraftState,
  side: Side,
  championId: string,
): Position | null {
  return positionOf(state.assignments, side, championId);
}

function positionOf(
  assignments: DraftState["assignments"],
  side: Side,
  championId: string,
): Position | null {
  for (const position of POSITIONS) {
    if (assignments[side][position] === championId) return position;
  }
  return null;
}

function removeChampion(
  assignments: DraftState["assignments"],
  side: Side,
  championId: string,
): DraftState["assignments"] {
  const sideAssignment = { ...assignments[side] };
  for (const position of POSITIONS) {
    if (sideAssignment[position] === championId) sideAssignment[position] = null;
  }
  return { ...assignments, [side]: sideAssignment };
}
