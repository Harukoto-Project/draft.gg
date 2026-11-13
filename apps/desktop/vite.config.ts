import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiHost = process.env.API_HOST ?? "127.0.0.1";
const apiPort = process.env.API_PORT ?? "3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // .env はリポジトリのルートに置く。クライアントに渡るのは `VITE_` で始まる変数だけ
  envDir: fileURLToPath(new URL("../..", import.meta.url)),
  // Tauri が固定ポートを前提にするため、使用中なら起動を失敗させる
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // ブラウザだけで画面を開発するとき、`/api` を api(別プロセス)へ中継する(Tauri は api に直接つなぐ)
    proxy: { "/api": `http://${apiHost}:${apiPort}` },
  },
  build: {
    target: "es2023",
  },
});
