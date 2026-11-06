import { drizzle } from "drizzle-orm/mysql2";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";

import * as schema from "./schema/index.js";

export type Database = MySql2Database<typeof schema>;

export interface DatabaseConnection {
  db: Database;
  close(): Promise<void>;
}

/**
 * MySQL に接続する。接続文字列(例: mysql://user:pass@host:3306/dbname)は
 * .env の DATABASE_URL から渡し、コードやログには書かない。
 */
export function createDatabase(connectionUrl: string): DatabaseConnection {
  const pool = createPool({
    uri: connectionUrl,
    charset: "utf8mb4",
    connectionLimit: 5,
    // DATETIME を UTC で扱い、実行環境のタイムゾーンに依存させない
    timezone: "Z",
  });
  const db = drizzle(pool, { schema, mode: "default" });
  return {
    db,
    close: () => pool.end(),
  };
}
