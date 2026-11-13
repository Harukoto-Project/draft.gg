import { invoke } from "@tauri-apps/api/core";

/**
 * Tauri コマンドを呼ぶ。Rust 側のエラーは文字列(エラーコード)で返るので、Error に包んで投げ直す。
 */
export async function callCommand<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return args === undefined ? await invoke<T>(name) : await invoke<T>(name, args);
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}
