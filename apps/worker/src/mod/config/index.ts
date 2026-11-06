export interface WorkerConfig {
  databaseUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL が設定されていません(.env を確認してください)");
  }
  return { databaseUrl };
}
