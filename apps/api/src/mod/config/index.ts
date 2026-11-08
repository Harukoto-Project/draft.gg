const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3001;

/**
 * api はループバックでのみ待ち受け、外部へは cloudflared 経由でのみ公開する。
 * 設定ミスで他の経路が開かないよう、これ以外のホストは起動時にエラーにする。
 */
const ALLOWED_HOSTS: readonly string[] = ["127.0.0.1", "::1"];

/** Better Auth のシークレットの最短の長さ */
const MIN_AUTH_SECRET_LENGTH = 32;

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

/** Discord ログインの設定。全部そろっているときだけログインを有効にする */
export interface AuthConfig {
  /** ブラウザからアクセスする公開URL(例: https://draft.example.com)。Cookie と OAuth の戻り先になる */
  baseUrl: string;
  secret: string;
  discordClientId: string;
  discordClientSecret: string;
}

export interface ApiConfig {
  host: string;
  port: number;
  databaseUrl: string;
  /** null のときはログインなしで動く(`/api/me/*` は 401) */
  auth: AuthConfig | null;
}

const AUTH_ENV_KEYS = [
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
] as const;

/** 環境変数(Node の process.env、Workers の env)から読める最小の形 */
export type EnvSource = Record<string, string | undefined>;

/** ログインの設定を環境変数から読む。4つとも空なら null(ログインなし) */
export function loadAuthConfig(env: EnvSource): AuthConfig | null {
  const values = AUTH_ENV_KEYS.map((key) => env[key] ?? "");
  const missing = AUTH_ENV_KEYS.filter((_, index) => values[index] === "");
  if (missing.length === AUTH_ENV_KEYS.length) return null;
  if (missing.length > 0) {
    throw new Error(`ログインの設定が足りません: ${missing.join(", ")}(.env を確認してください)`);
  }

  const [baseUrl, secret, discordClientId, discordClientSecret] = values as [
    string,
    string,
    string,
    string,
  ];
  let origin: string;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
    origin = url.origin;
  } catch {
    throw new Error("BETTER_AUTH_URL が不正です(http(s):// から始まる URL を指定してください)");
  }
  if (secret.length < MIN_AUTH_SECRET_LENGTH) {
    throw new Error(`BETTER_AUTH_SECRET は ${MIN_AUTH_SECRET_LENGTH} 文字以上にしてください`);
  }

  return { baseUrl: origin, secret, discordClientId, discordClientSecret };
}

export function loadConfig(env: EnvSource = process.env): ApiConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL が設定されていません(.env を確認してください)");
  }
  return {
    host: parseHost(env.API_HOST),
    port: parsePort(env.API_PORT),
    databaseUrl,
    auth: loadAuthConfig(env),
  };
}
