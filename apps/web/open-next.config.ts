import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// キャッシュ(R2・KV・D1)は使わない。既定のメモリ内キャッシュのまま動かす。
export default defineCloudflareConfig();
