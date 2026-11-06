const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3001;

/**
 * api はループバックでのみ待ち受け、外部へは cloudflared 経由でのみ公開する。
 * 設定ミスで他の経路が開かないよう、これ以外のホストは起動時にエラーにする。
 */
const ALLOWED_HOSTS: readonly string[] = ["127.0.0.1", "::1"];

function parseHost(value: string | undefined): string {
  if (value === undefined || value === "") return DEFAULT_HOST;
  if (!ALLOWED_HOSTS.includes(value)) {
    throw new Error(
      `API_HOST が不正です: ${value}(${ALLOWED_HOSTS.join(" か ")} のみ指定できます)`,
    );
  }
  return value;
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === "") return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`API_PORT が不正です: ${value}`);
  }
  return port;
}

export interface ApiConfig {
  host: string;
  port: number;
  databaseUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL が設定されていません(.env を確認してください)");
  }
  return {
    host: parseHost(env.API_HOST),
    port: parsePort(env.API_PORT),
    databaseUrl,
  };
}
