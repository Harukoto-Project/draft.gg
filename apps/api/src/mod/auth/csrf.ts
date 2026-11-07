import { createMiddleware } from "hono/factory";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * 状態を変えるリクエストは、Origin がこのサイト自身のときだけ通す。
 * Cookie は同じサイトの兄弟サブドメインからも付くため、Cookie だけでは送り元を信用できない。
 * ブラウザは GET / HEAD 以外のリクエストに必ず Origin を付けるので、無ければ弾く。
 * `allowedOrigin` が null(認証が無効)のときは何もしない。
 */
export function requireSameOrigin(allowedOrigin: string | null) {
  return createMiddleware(async (c, next) => {
    if (allowedOrigin === null || SAFE_METHODS.has(c.req.method)) return next();
    if (c.req.header("origin") !== allowedOrigin) return c.json({ error: "forbidden_origin" }, 403);
    return next();
  });
}
