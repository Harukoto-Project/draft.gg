import { detectFeel, storedFeel } from "@/lib/ballmac/feel";

/** Tauri のウェブビューの中で動いているか。ブラウザ(開発時の確認用)では false */
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * ウィンドウ枠の見た目(feel)を最初の描画前に決める。
 * Tauri ではOSに合わせた枠(Windows / macOS)、ブラウザでは枠なし(web)にする。
 */
export function initWindowFeel(): void {
  const feel = isTauri ? (storedFeel() ?? detectFeel()) : "web";
  document.documentElement.setAttribute("data-feel", feel);
}
