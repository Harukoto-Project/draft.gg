import type { ProActionType, Side } from "@draftgg/shared";

export interface NamedDraftAction {
  side: Side;
  type: ProActionType;
  order: number | null;
  name: string;
}

/**
 * 大会形式の順番。
 * 先攻側が第1BANと第1ピックを行い、第2BANフェーズは後攻側から始まる。
 * first が null のときは順番を付けない。
 */
export function assignDraftOrder(input: {
  first: Side | null;
  bluePicks: string[];
  redPicks: string[];
  blueBans: string[];
  redBans: string[];
}): NamedDraftAction[] {
  return [
    ...place("ban", input.first, input.blueBans, input.redBans, banSides),
    ...place("pick", input.first, input.bluePicks, input.redPicks, pickSides),
  ];
}

function place(
  type: ProActionType,
  first: Side | null,
  blue: string[],
  red: string[],
  sides: (first: Side) => Side[],
): NamedDraftAction[] {
  const names = { blue, red };
  if (!first) {
    return (["blue", "red"] as const).flatMap((side) =>
      names[side].filter(Boolean).map((name) => ({ side, type, order: null, name })),
    );
  }

  const cursor = { blue: 0, red: 0 };
  const actions: NamedDraftAction[] = [];
  for (const [index, side] of sides(first).entries()) {
    const name = names[side][cursor[side]];
    cursor[side] += 1;
    if (!name) continue;
    actions.push({ side, type, order: index + 1, name });
  }
  return actions;
}

function pickSides(first: Side): Side[] {
  const other = opposite(first);
  return [first, other, other, first, first, other, other, first, first, other];
}

function banSides(first: Side): Side[] {
  const other = opposite(first);
  return [first, other, first, other, first, other, other, first, other, first];
}

function opposite(side: Side): Side {
  return side === "blue" ? "red" : "blue";
}
