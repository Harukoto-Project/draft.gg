import { getCurrentWindow } from "@tauri-apps/api/window";

import { isTauri } from "@/lib/platform";

/** Tauri のウィンドウ操作。ブラウザで動いているときは何もしない */

export async function closeWindow(): Promise<void> {
  if (isTauri) await getCurrentWindow().close();
}

export async function minimizeWindow(): Promise<void> {
  if (isTauri) await getCurrentWindow().minimize();
}

export async function toggleMaximizeWindow(): Promise<void> {
  if (isTauri) await getCurrentWindow().toggleMaximize();
}

export async function isWindowMaximized(): Promise<boolean> {
  return isTauri ? getCurrentWindow().isMaximized() : false;
}

/** ウィンドウのサイズ変更を購読する。戻り値は購読解除関数 */
export async function onWindowResized(handler: () => void): Promise<() => void> {
  if (!isTauri) return () => {};
  return getCurrentWindow().onResized(handler);
}
