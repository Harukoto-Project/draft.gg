import { getCurrentWindow } from "@tauri-apps/api/window";

import { isTauri } from "@/lib/platform";
import { callCommand } from "@/services/tauri";

/** ウィンドウの下地。mica は Windows 11 の Mica が使えているとき、none はそれ以外 */
export type Backdrop = "mica" | "none";

/** Rust 側で Mica を適用できたか。取れなければ、単色の下地で起動を続ける */
export async function loadBackdrop(): Promise<Backdrop> {
  if (!isTauri) return "none";
  try {
    const value = await callCommand<unknown>("window_backdrop");
    return value === "mica" ? "mica" : "none";
  } catch {
    return "none";
  }
}

/**
 * アプリで選んだ明暗を、ウィンドウ(= Mica の明暗)にも伝える。
 * system や未知の値は null を渡し、OS の設定に従わせる。
 */
export async function setWindowTheme(theme: string | undefined): Promise<void> {
  if (!isTauri) return;
  await getCurrentWindow().setTheme(theme === "light" || theme === "dark" ? theme : null);
}
