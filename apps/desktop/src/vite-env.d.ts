/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** api の公開 URL。Tauri のアプリがつなぐ先(秘密ではない) */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
