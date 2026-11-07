import type { ChampionRef } from "@draftgg/shared";

import type { Scored } from "./score.js";

/** 5人構成でダメージが 2:3 に割れたときの、少ない側の割合。これ以上なら偏りなしとみなす */
const BALANCED_MINORITY_SHARE = 0.4;
/** 味方の偏りを理由に出す、少ない側の割合の上限 */
const SKEWED_MINORITY_SHARE = 0.25;

/** 前衛の量。タンクは 1、ファイターは 0.6。合計がこの値以上なら十分とみなす */
const FRONTLINE_TARGET = 1.6;
const TANK_FRONTLINE = 1;
const FIGHTER_FRONTLINE = 0.6;
/** 前衛が足りないとみなす味方の合計 */
const FRONTLINE_SHORT = 0.6;

const DAMAGE_WEIGHT = 0.6;
const FRONTLINE_WEIGHT = 0.4;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** AD と AP の量。複合は半分ずつ、未取得は数えない */
function damageShares(champions: readonly ChampionRef[]): { ad: number; ap: number } {
  let ad = 0;
  let ap = 0;
  for (const champion of champions) {
    if (champion.damageType === "ad") ad += 1;
    else if (champion.damageType === "ap") ap += 1;
    else if (champion.damageType === "mixed") {
      ad += 0.5;
      ap += 0.5;
    }
  }
  return { ad, ap };
}

function minorityShare({ ad, ap }: { ad: number; ap: number }): number {
  const total = ad + ap;
  return total > 0 ? Math.min(ad, ap) / total : 0;
}

export function frontlineValue(champion: ChampionRef): number {
  const tags = champion.tags ?? [];
  if (tags.includes("Tank")) return TANK_FRONTLINE;
  if (tags.includes("Fighter")) return FIGHTER_FRONTLINE;
  return 0;
}

function damageScore(
  allies: readonly ChampionRef[],
  candidate: ChampionRef,
): { score: number; reason: string | null } | null {
  if (!candidate.damageType) return null;
  const before = damageShares(allies);
  if (before.ad + before.ap === 0) return null;
  const after = damageShares([...allies, candidate]);

  let reason: string | null = null;
  if (minorityShare(before) < SKEWED_MINORITY_SHARE) {
    const majority = before.ad >= before.ap ? "ad" : "ap";
    const minority = majority === "ad" ? "ap" : "ad";
    if (candidate.damageType === minority) {
      reason = `味方は${majority === "ad" ? "AD" : "AP"}寄りのため、${minority === "ad" ? "AD" : "AP"}を足して物理・魔法のバランスを補える`;
    } else if (candidate.damageType === majority) {
      reason = `味方は${majority === "ad" ? "AD" : "AP"}寄りで、さらに偏る`;
    }
  }
  return { score: clamp01(minorityShare(after) / BALANCED_MINORITY_SHARE), reason };
}

function frontlineScore(
  allies: readonly ChampionRef[],
  candidate: ChampionRef,
): { score: number; reason: string | null } | null {
  if (!candidate.tags) return null;
  const team = allies.reduce((sum, ally) => sum + frontlineValue(ally), 0);
  const added = frontlineValue(candidate);
  const reason =
    team < FRONTLINE_SHORT && added >= FIGHTER_FRONTLINE
      ? "前衛(タンク・ファイター)が不足している味方構成を補える"
      : null;
  return { score: clamp01((team + added) / FRONTLINE_TARGET), reason };
}

/**
 * 味方の構成を補うか。AD / AP のバランスと、前衛(タンク・ファイター)の量で見る。
 * 味方のピックが無いとき、候補の属性が無いときは計算しない(null)。
 */
export function scoreComposition(
  allies: readonly ChampionRef[],
  candidate: ChampionRef | undefined,
): Scored | null {
  if (!candidate || allies.length === 0) return null;
  const damage = damageScore(allies, candidate);
  const frontline = frontlineScore(allies, candidate);

  const parts = [
    ...(damage ? [{ weight: DAMAGE_WEIGHT, ...damage }] : []),
    ...(frontline ? [{ weight: FRONTLINE_WEIGHT, ...frontline }] : []),
  ];
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight <= 0) return null;

  return {
    score: parts.reduce((sum, part) => sum + (part.weight / totalWeight) * part.score, 0),
    reasons: parts.flatMap((part) => (part.reason ? [part.reason] : [])),
    insufficient: false,
  };
}
