import { POSITION_LABELS } from "@draftgg/shared";
import type { Champion, RecommendationCandidate } from "@draftgg/shared";

import { ChampionIcon } from "@/components/champion/ChampionIcon";
import { FactorBars } from "@/components/recommendation/FactorBars";
import { RoleIcon } from "@/components/role/RoleIcon";
import { formatMessage } from "@/lib/formatMessage";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

export function CandidateCard({
  candidate,
  champion,
  kind,
  rank,
  canPick,
  onPick,
}: {
  candidate: RecommendationCandidate;
  /** 画像用。チャンピオン一覧が未取得なら undefined */
  champion: Champion | undefined;
  kind: "pick" | "ban";
  rank: number;
  canPick: boolean;
  onPick: (championId: string) => void;
}) {
  const score = Math.round(candidate.score * 100);
  return (
    <li className="overflow-hidden rounded-xs border bg-muted/40">
      <button
        type="button"
        disabled={!canPick}
        aria-label={formatMessage(ja.recommendation.candidateLabel, {
          champion: candidate.nameJa,
          role: POSITION_LABELS[candidate.position],
          score: String(score),
        })}
        onClick={() => onPick(candidate.championId)}
        className={cn(
          "flex w-full min-w-0 cursor-pointer items-center gap-3 p-2 text-left transition-colors outline-none hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:hover:bg-transparent",
        )}
      >
        <span className="w-4 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
          {rank}
        </span>
        <span className="relative size-10 shrink-0 overflow-hidden rounded-xs bg-muted">
          {champion ? <ChampionIcon champion={champion} /> : null}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{candidate.nameJa}</span>
          <RoleIcon position={candidate.position} className="size-4 shrink-0 opacity-75" />
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-lg leading-none font-semibold text-foreground tabular-nums">
            {score}
          </span>
          <span className="block text-[0.625rem] text-muted-foreground">
            {ja.recommendation.score}
          </span>
        </span>
      </button>
      <div className="flex flex-col gap-2 px-2 pb-2">
        <FactorBars factors={candidate.factors} kind={kind} />
        {candidate.reasons.length > 0 ? (
          <ul className="flex flex-col gap-0.5">
            {candidate.reasons.map((reason, index) => (
              <li key={`${index}:${reason}`} className="text-xs text-muted-foreground">
                {reason}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}
