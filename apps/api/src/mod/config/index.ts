const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3001;

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
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    host: env.API_HOST || DEFAULT_HOST,
    port: parsePort(env.API_PORT),
  };
}
