export interface WorkerConfig {
  databaseUrl: string;
  leaguepedia: { username: string; password: string } | null;
  oraclesFileUrl?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL が設定されていません(.env を確認してください)");
  }
  const username = env.LEAGUEPEDIA_BOT_USERNAME?.trim();
  const password = env.LEAGUEPEDIA_BOT_PASSWORD?.trim();
  const oraclesFileUrl = env.ORACLES_ELIXIR_CSV_URL?.trim();
  return {
    databaseUrl,
    leaguepedia: username && password ? { username, password } : null,
    oraclesFileUrl: oraclesFileUrl || undefined,
  };
}
