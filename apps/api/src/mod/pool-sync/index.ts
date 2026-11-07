import { connectOpggTransport, createOpggClient } from "@draftgg/data-sources";
import type { OpggClient } from "@draftgg/data-sources";
import { parseRiotId, resolvePoolPosition } from "@draftgg/shared";
import type { PoolEntry, Position, RiotRegion, StatsSnapshot } from "@draftgg/shared";

/** 同時に OP.GG へ問い合わせる最大数。超えたら待たせず断る */
const MAX_CONCURRENT_SYNCS = 2;

/** 全ユーザー合計で、1 分間に OP.GG へ問い合わせる上限。超えたら待たせず断る */
const MAX_SYNCS_PER_MINUTE = 10;
const RATE_WINDOW_MS = 60 * 1000;

/** 接続から取得までの上限 */
const SYNC_TIMEOUT_MS = 45_000;

export type PoolSyncErrorCode = "invalid_riot_id" | "busy" | "unavailable";

export class PoolSyncError extends Error {
  constructor(readonly code: PoolSyncErrorCode) {
    super(code);
    this.name = "PoolSyncError";
  }
}

export interface PoolSyncInput {
  /** `ゲーム名#タグ` */
  riotId: string;
  region: RiotRegion;
  /** プレイヤーのロール。空ならチャンピオンの最も多いロールに置く */
  roles: Position[];
}

export interface PoolSync {
  /** OP.GG の使用履歴から、プールの候補(source: opgg)を作る */
  fetch(input: PoolSyncInput): Promise<PoolEntry[]>;
}

export interface PoolSyncOptions {
  getSnapshot: () => StatsSnapshot;
  /** テストで差し替える。既定は OP.GG の公式 MCP に接続する */
  connect?: () => Promise<OpggClient>;
  /** テストで時刻を固定する */
  now?: () => number;
}

async function connectClient(): Promise<OpggClient> {
  return createOpggClient(await connectOpggTransport("draftgg-api"));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PoolSyncError("unavailable")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * ユーザー操作を起点に、1人ぶんのプールを OP.GG から取得する(外部 API を api から呼ぶ唯一の経路)。
 * 呼び出しのたびに接続して閉じる。回数はルート側の最短間隔と、ここの同時実行の上限で抑える。
 */
export function createPoolSync(options: PoolSyncOptions): PoolSync {
  const connect = options.connect ?? connectClient;
  const now = options.now ?? Date.now;
  let running = 0;
  /** 直近の問い合わせの開始時刻 */
  let recent: number[] = [];

  return {
    async fetch(input) {
      const riotId = parseRiotId(input.riotId);
      if (!riotId) throw new PoolSyncError("invalid_riot_id");

      const snapshot = options.getSnapshot();
      if (snapshot.champions.length === 0) throw new PoolSyncError("unavailable");
      if (running >= MAX_CONCURRENT_SYNCS) throw new PoolSyncError("busy");
      const startedAt = now();
      recent = recent.filter((at) => startedAt - at < RATE_WINDOW_MS);
      if (recent.length >= MAX_SYNCS_PER_MINUTE) throw new PoolSyncError("busy");
      recent.push(startedAt);

      running += 1;
      let client: OpggClient | undefined;
      // タイムアウトで待つのをやめたあとに接続できた場合も、接続を閉じて残さない
      let abandoned = false;
      try {
        const task = (async () => {
          const connected = await connect();
          client = connected;
          if (abandoned) {
            void connected.close().catch(() => undefined);
            throw new PoolSyncError("unavailable");
          }
          return connected.getSummonerPool({ ...riotId, region: input.region });
        })();
        const synced = await withTimeout(task, SYNC_TIMEOUT_MS);

        const byNumeric = new Map(
          snapshot.champions.map((champion) => [champion.numericKey, champion]),
        );
        const entries = new Map<string, PoolEntry>();
        for (const item of synced) {
          const champion = byNumeric.get(item.numericKey);
          if (!champion) continue;
          const position = resolvePoolPosition(champion.id, snapshot.meta, input.roles);
          if (!position) continue;
          entries.set(`${champion.id}:${position}`, {
            championId: champion.id,
            position,
            source: "opgg",
            games: item.games,
            winRate: item.winRate,
            excluded: false,
          });
        }
        return [...entries.values()];
      } catch (error) {
        if (error instanceof PoolSyncError) throw error;
        console.log(
          JSON.stringify({
            level: "error",
            msg: "pool sync failed",
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        throw new PoolSyncError("unavailable");
      } finally {
        abandoned = true;
        running -= 1;
        void client?.close().catch(() => undefined);
      }
    },
  };
}
