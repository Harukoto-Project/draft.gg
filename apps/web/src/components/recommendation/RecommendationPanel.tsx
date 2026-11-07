"use client";

import { POSITION_LABELS } from "@draftgg/shared";
import type { Champion, RecommendationCandidate, RecommendationResponse } from "@draftgg/shared";
import { useMemo, useState } from "react";

import { CandidateCard } from "@/components/recommendation/CandidateCard";
import { MyRolePicker } from "@/components/recommendation/MyRolePicker";
import { PlayerPicker } from "@/components/recommendation/PlayerPicker";
import { RoleIcon } from "@/components/role/RoleIcon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDraft } from "@/hooks/use-draft";
import { useMe } from "@/hooks/use-me";
import { useProfiles } from "@/hooks/use-profiles";
import { useRecommendations } from "@/hooks/use-recommendations";
import { formatMessage } from "@/lib/formatMessage";
import { buildPoolHints } from "@/lib/poolHints";
import ja from "@/messages/ja.json";

type View = "pick" | "ban";

export function RecommendationPanel({
  championsById,
  activeType,
  onPick,
}: {
  championsById: ReadonlyMap<string, Champion>;
  /** 選んでいる枠の種類。候補を押して入れられるのは、同じ種類のときだけ */
  activeType: "ban" | "pick" | null;
  onPick: (championId: string) => void;
}) {
  const { state, ready, chooseMyPosition } = useDraft();
  const me = useMe();
  const profiles = useProfiles(Boolean(me.data?.user));
  const [playerId, setPlayerId] = useState<string | null>(null);
  const player = profiles.data?.find((profile) => profile.id === playerId);
  const pools = useMemo(
    () => buildPoolHints(player, state.me?.position ?? null),
    [player, state.me?.position],
  );
  const query = useRecommendations(state, ready, pools);
  const [view, setView] = useState<View>("pick");
  // プールはソロ(自分のロールを選んだとき)だけ使う
  const showPlayerPicker = state.me !== null && (profiles.data?.length ?? 0) > 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <MyRolePicker value={state.me?.position ?? null} onChange={chooseMyPosition} />
        {showPlayerPicker ? (
          <PlayerPicker
            profiles={profiles.data ?? []}
            value={player?.id ?? null}
            onChange={setPlayerId}
          />
        ) : null}
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={0}
          value={view}
          aria-label={ja.recommendation.title}
          onValueChange={(value) => {
            if (value === "pick" || value === "ban") setView(value);
          }}
        >
          <ToggleGroupItem value="pick">{ja.recommendation.tabPick}</ToggleGroupItem>
          <ToggleGroupItem value="ban">{ja.recommendation.tabBan}</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={query.isFetching}>
        {query.isPending ? (
          <PanelSkeleton />
        ) : query.isError && !query.data ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-foreground">{ja.recommendation.loadError}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              {ja.recommendation.retry}
            </Button>
          </div>
        ) : query.data ? (
          <Suggestions
            data={query.data}
            view={view}
            championsById={championsById}
            activeType={activeType}
            onPick={onPick}
          />
        ) : null}
      </div>
      <p className="shrink-0 text-xs text-muted-foreground">
        {query.data?.patch
          ? `${formatMessage(ja.recommendation.patch, { version: query.data.patch })}。`
          : ""}
        {ja.recommendation.disclaimer}
      </p>
    </div>
  );
}

function Suggestions({
  data,
  view,
  championsById,
  activeType,
  onPick,
}: {
  data: RecommendationResponse;
  view: View;
  championsById: ReadonlyMap<string, Champion>;
  activeType: "ban" | "pick" | null;
  onPick: (championId: string) => void;
}) {
  const noStats =
    data.bans.length === 0 && data.picks.every((entry) => entry.candidates.length === 0);
  if (noStats) {
    return <p className="max-w-sm text-sm text-foreground">{ja.recommendation.empty}</p>;
  }

  if (view === "ban") {
    if (data.bans.length === 0) {
      return <p className="text-sm text-foreground">{ja.recommendation.noBans}</p>;
    }
    return (
      <CandidateList
        candidates={data.bans}
        kind="ban"
        championsById={championsById}
        canPick={activeType === "ban"}
        onPick={onPick}
      />
    );
  }

  if (data.picks.length === 0) {
    return <p className="text-sm text-foreground">{ja.recommendation.noPicks}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {data.picks.map((entry) => (
        <section key={entry.position} className="flex flex-col gap-2">
          {data.picks.length > 1 ? (
            <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
              <RoleIcon position={entry.position} className="size-4" />
              {POSITION_LABELS[entry.position]}
            </h3>
          ) : null}
          {entry.candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{ja.recommendation.noPickRole}</p>
          ) : (
            <CandidateList
              candidates={entry.candidates}
              kind="pick"
              championsById={championsById}
              canPick={activeType === "pick"}
              onPick={onPick}
            />
          )}
        </section>
      ))}
    </div>
  );
}

function CandidateList({
  candidates,
  kind,
  championsById,
  canPick,
  onPick,
}: {
  candidates: RecommendationCandidate[];
  kind: "pick" | "ban";
  championsById: ReadonlyMap<string, Champion>;
  canPick: boolean;
  onPick: (championId: string) => void;
}) {
  return (
    <ol className="flex flex-col gap-2">
      {candidates.map((candidate, index) => (
        <CandidateCard
          key={candidate.championId}
          candidate={candidate}
          champion={championsById.get(candidate.championId)}
          kind={kind}
          rank={index + 1}
          canPick={canPick}
          onPick={onPick}
        />
      ))}
    </ol>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-24 w-full" />
      ))}
    </div>
  );
}
