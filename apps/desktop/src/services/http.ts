import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

import { isTauri } from "@/lib/platform";

/**
 * api の接続先。Tauri のアプリは api に直接つなぐ(CORS は使わない)。
 * ブラウザで画面だけ開発するときは同一オリジンの `/api` を使い、Vite が api へ中継する。
 */
const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ||
  (isTauri && import.meta.env.DEV ? "http://127.0.0.1:3001" : "");

/** api を呼ぶ。Tauri では Rust 側の HTTP クライアントを使う */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const run = isTauri ? tauriFetch : fetch;
  return run(`${API_BASE_URL}${path}`, init);
}

/** API が返したエラー。`code` は API の `{ error }`、`retryAfterSeconds` は 429 の待ち時間 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, code: string, retryAfterSeconds: number | null) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** 失敗(2xx 以外)なら ApiError を投げる。成功時は Response をそのまま返す */
export async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await apiFetch(path, init);
  if (response.ok) return response;

  const body: unknown = await response.json().catch(() => null);
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const code = typeof record.error === "string" ? record.error : "request_failed";
  const retryAfter = Number(record.retryAfterSeconds ?? response.headers.get("Retry-After"));
  throw new ApiError(
    response.status,
    code,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  );
}

export function jsonInit(method: string, body: unknown, signal?: AbortSignal): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  };
}
