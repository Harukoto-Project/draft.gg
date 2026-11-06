export interface DdragonChampion {
  /** Data Dragon のキー(例: "Ahri") */
  id: string;
  /** Riot の数値ID(例: 103) */
  numericKey: number;
  nameJa: string;
  nameEn: string;
  tags: string[];
  /** 画像取得に使う Data Dragon のバージョン */
  imageVersion: string;
}

export interface DdragonClient {
  /** 最新の Data Dragon のバージョン(例: "16.21.1") */
  fetchLatestVersion(): Promise<string>;
  /** 指定バージョンのチャンピオン一覧(日本語名・英語名を結合済み) */
  fetchChampions(version: string): Promise<DdragonChampion[]>;
}
