import { Hono } from "hono";

import { health } from "./health.js";

// 1エンドポイント群 = 1ファイル。新しいルートはここに登録する。
export const routes = new Hono().route("/health", health);
