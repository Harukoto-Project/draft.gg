export type LogLevel = "info" | "warn" | "error";

export interface Logger {
  (level: LogLevel, msg: string, fields?: Record<string, unknown>): void;
}

/** 構造化ログ(JSON)を標準出力に出す。OSのサービスのログ機能で確認する。 */
export const log: Logger = (level, msg, fields) => {
  console.log(JSON.stringify({ level, msg, ...fields }));
};
