import { drizzle } from "drizzle-orm/mysql2";
import { createConnection } from "mysql2/promise";

import type { DatabaseConnection } from "./client.js";
import * as schema from "./schema/index.js";

/** Cloudflare Hyperdrive のバインディングのうち、接続に使う項目 */
export interface HyperdriveBinding {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Cloudflare Workers から Hyperdrive 経由で MySQL に接続する。
 * Workers は別のリクエストの I/O を使い回せないので、リクエストごとに1本だけ作って閉じる
 * (接続のプールは Hyperdrive が持つ)。
 */
export async function createDatabaseFromHyperdrive(
  binding: HyperdriveBinding,
): Promise<DatabaseConnection> {
  const connection = await createConnection({
    host: binding.host,
    port: binding.port,
    user: binding.user,
    password: binding.password,
    database: binding.database,
    charset: "utf8mb4",
    // DATETIME を UTC で扱い、実行環境のタイムゾーンに依存させない
    timezone: "Z",
    // Workers では eval が使えないので、mysql2 の動的コード生成を切る
    disableEval: true,
  });
  return {
    db: drizzle(connection, { schema, mode: "default" }),
    close: () => connection.end(),
  };
}
