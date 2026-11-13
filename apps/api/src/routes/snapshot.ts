import type { StatsSnapshot } from "@draftgg/shared";
import { Hono } from "hono";
import { compress } from "hono/compress";

export interface SnapshotSource {
  getSnapshot(): StatsSnapshot;
}

interface Serialized {
  body: string;
  etag: string;
}

/** 同じスナップショット(同じオブジェクト)を、リクエストのたびにシリアライズ・ハッシュしないための置き場 */
const serialized = new WeakMap<StatsSnapshot, Serialized>();

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function serialize(snapshot: StatsSnapshot): Promise<Serialized> {
  const cached = serialized.get(snapshot);
  if (cached) return cached;

  const body = JSON.stringify(snapshot);
  const entry = { body, etag: `"${await sha256Hex(body)}"` };
  serialized.set(snapshot, entry);
  return entry;
}

/** If-None-Match(カンマ区切り、弱い ETag、`*` を含む)が現在の ETag に当たるか */
function matchesEtag(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((candidate) => {
    const value = candidate.trim().replace(/^W\//, "");
    return value === "*" || value === etag;
  });
}

/**
 * アプリが提案計算に使う統計スナップショットを、1 つの JSON で返す。公開データなので認証は無い。
 * ETag は中身のハッシュで、一致すれば 304 を返す(アプリは起動時と定期的に確認するだけ)。
 */
export function createSnapshotRoute(source: SnapshotSource) {
  return new Hono().use(compress()).get("/", async (c) => {
    const snapshot = source.getSnapshot();
    // 取り込みが一度も終わっていない間の空のデータを、アプリに保存させない
    if (snapshot.patch === null) {
      c.header("Cache-Control", "no-store");
      return c.json({ error: "snapshot_unavailable" }, 503);
    }

    const { body, etag } = await serialize(snapshot);
    c.header("ETag", etag);
    c.header("Cache-Control", "public, max-age=300");
    if (matchesEtag(c.req.header("If-None-Match"), etag)) return c.body(null, 304);

    c.header("Content-Type", "application/json; charset=UTF-8");
    return c.body(body);
  });
}
