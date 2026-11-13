import { useEffect } from "react";

/** Rust 側(lib.rs)の button_id と合わせる */
export const SNAP_BUTTON_ID = "snap-btn";

/**
 * Windows 11 のスナップレイアウトの対象にするため、自前の最大化ボタンに id を付ける。
 * ボタンは Ballmac の AppWindow が描くので、部品を直接書き換えずに実行時に付ける。
 * 最大化中は同じボタンが「元に戻す」に変わる(data-slot だけが変わる)ので、どちらも探す。
 * Windows 以外ではボタン自体が無いため何も起きない。
 */
export function useSnapLayoutTarget(): void {
  useEffect(() => {
    const button = document.querySelector<HTMLElement>(
      '[data-slot="app-window-maximize"], [data-slot="app-window-restore"]',
    );
    if (!button) return;
    button.id = SNAP_BUTTON_ID;
    return () => {
      if (button.id === SNAP_BUTTON_ID) button.removeAttribute("id");
    };
  }, []);
}
