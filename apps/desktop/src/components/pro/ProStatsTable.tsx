import { POSITION_LABELS } from "@draftgg/shared";
import type { Champion } from "@draftgg/shared";

import { ChampionIcon } from "@/components/champion/ChampionIcon";
import { RoleIcon } from "@/components/role/RoleIcon";
import { formatPercent } from "@/lib/proStats";
import type { ProSortKey, ProStatRow, SortDirection } from "@/lib/proStats";
import { formatMessage } from "@/lib/formatMessage";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

const COLUMNS: readonly { key: ProSortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: ja.pro.column.champion, numeric: false },
  { key: "games", label: ja.pro.column.games, numeric: true },
  { key: "picks", label: ja.pro.column.picks, numeric: true },
  { key: "bans", label: ja.pro.column.bans, numeric: true },
  { key: "presence", label: ja.pro.column.presence, numeric: true },
  { key: "winRate", label: ja.pro.column.winRate, numeric: true },
  { key: "early", label: ja.pro.column.early, numeric: true },
];

export function ProStatsTable({
  rows,
  championsById,
  sortKey,
  direction,
  onSort,
}: {
  rows: readonly ProStatRow[];
  championsById: ReadonlyMap<string, Champion>;
  sortKey: ProSortKey;
  direction: SortDirection;
  onSort: (key: ProSortKey) => void;
}) {
  return (
    <table className="w-full min-w-[40rem] border-collapse text-sm">
      <caption className="sr-only">{ja.pro.title}</caption>
      <thead className="sticky top-0 z-10 bg-card">
        <tr className="border-b border-border">
          {COLUMNS.map((column) => {
            const active = sortKey === column.key;
            return (
              <th
                key={column.key}
                scope="col"
                aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
                className={cn("p-0 font-normal", column.numeric ? "text-right" : "text-left")}
              >
                <button
                  type="button"
                  title={column.key === "presence" ? ja.pro.presenceHint : undefined}
                  aria-label={formatMessage(ja.pro.sortBy, { column: column.label })}
                  onClick={() => onSort(column.key)}
                  className={cn(
                    "w-full cursor-pointer px-3 py-2 text-xs transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    column.numeric ? "text-right" : "text-left",
                    active ? "text-gold" : "text-muted-foreground",
                  )}
                >
                  {column.label}
                  {active ? (
                    <span aria-hidden="true">{direction === "asc" ? " ▲" : " ▼"}</span>
                  ) : null}
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const champion = championsById.get(row.championId);
          return (
            <tr
              key={`${row.championId}:${row.position}`}
              className="border-b border-border/50 hover:bg-muted/50"
            >
              <td className="px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="relative size-8 shrink-0 overflow-hidden bg-muted">
                    {champion ? <ChampionIcon champion={champion} /> : null}
                  </span>
                  <span className="truncate text-foreground">{row.nameJa}</span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <RoleIcon position={row.position} className="size-4 opacity-75" />
                    <span className="sr-only">{POSITION_LABELS[row.position]}</span>
                  </span>
                </div>
              </td>
              <Cell value={String(row.games)} />
              <Cell value={String(row.picks)} />
              <Cell value={String(row.bans)} />
              <Cell value={formatPercent(row.presence)} strong />
              <Cell value={formatPercent(row.winRate)} />
              <Cell value={formatPercent(row.earlyPickRate)} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Cell({ value, strong }: { value: string; strong?: boolean }) {
  return (
    <td
      className={cn(
        "px-3 py-1.5 text-right tabular-nums",
        strong ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {value}
    </td>
  );
}
