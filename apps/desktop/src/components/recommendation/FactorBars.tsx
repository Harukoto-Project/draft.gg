import type { RecommendationCandidate } from "@draftgg/shared";

import ja from "@/messages/ja.json";

type FactorKey = keyof RecommendationCandidate["factors"];

const FACTOR_ORDER: readonly FactorKey[] = [
  "meta",
  "counter",
  "synergy",
  "pro",
  "pool",
  "composition",
];

/** 要素ごとのスコア(0〜1)を、横棒と数値で並べる。計算に使われなかった要素は出さない */
export function FactorBars({
  factors,
  kind,
}: {
  factors: RecommendationCandidate["factors"];
  /** BAN ではカウンターを「脅威」と呼ぶ */
  kind: "pick" | "ban";
}) {
  const rows = FACTOR_ORDER.flatMap((key) => {
    const value = factors[key];
    return value === undefined ? [] : [{ key, value }];
  });
  if (rows.length === 0) return null;

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
      {rows.map(({ key, value }) => {
        const label = kind === "ban" && key === "counter" ? "threat" : key;
        const percent = Math.round(clamp(value) * 100);
        return (
          <div key={key} className="col-span-3 grid grid-cols-subgrid items-center">
            <dt className="text-xs text-muted-foreground">{ja.recommendation.factor[label]}</dt>
            <dd className="h-1.5 bg-muted" aria-hidden="true">
              <span className="block h-full bg-selection" style={{ width: `${percent}%` }} />
            </dd>
            <dd className="w-7 text-right text-xs text-foreground tabular-nums">{percent}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
