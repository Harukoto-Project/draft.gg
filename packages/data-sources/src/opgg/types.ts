import type { ChampionRef, DamageType, Position } from "@draftgg/shared";

export interface LaneMetaRow {
  championId: string;
  position: Position;
  games: number;
  winRate: number;
  pickRate: number;
  banRate: number;
  roleRate: number;
  tierRank: number;
}

export interface ChampionAnalysis {
  championId: string;
  position: Position;
  games: number;
  winRate: number;
  pickRate: number;
  banRate: number;
  tierRank: number;
  damageType: DamageType | null;
  matchups: Array<{ opponentId: string; games: number; winRate: number }>;
  synergies: Array<{
    allyId: string;
    allyPosition: Position;
    games: number;
    winRate: number;
    score: number;
  }>;
}

/** プレイヤーのよく使うチャンピオン。ロールは OP.GG から取れない */
export interface SummonerPoolEntry {
  /** Data Dragon の `key`(数値) */
  numericKey: number;
  games: number;
  winRate: number;
}

export interface OpggTransport {
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

export interface OpggClient {
  listLaneMeta(catalog: ChampionRef[]): Promise<LaneMetaRow[]>;
  analyzeChampion(
    catalog: ChampionRef[],
    target: { championId: string; nameEn: string; position: Position; numericKey: number },
  ): Promise<ChampionAnalysis>;
  getSummonerPool(riotId: {
    gameName: string;
    tagLine: string;
    region: string;
  }): Promise<SummonerPoolEntry[]>;
  close(): Promise<void>;
}
