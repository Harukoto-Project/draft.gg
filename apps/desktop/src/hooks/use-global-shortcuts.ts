import { useEffect } from "react";
import { useNavigate } from "react-router";

import { NAV_ITEMS } from "@/config/navigation";
import { requestChampionSearchFocus } from "@/lib/championSearchFocus";

/**
 * アプリ全体のショートカット(Windows は Ctrl、macOS は ⌘)。
 *  - Ctrl+K: チャンピオン検索にフォーカス(別の画面ならドラフトへ移る)
 *  - Ctrl+1〜: ナビの順にページを切り替える
 */
export function useGlobalShortcuts(): void {
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.shiftKey) return;
      if (!(event.ctrlKey || event.metaKey)) return;

      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!requestChampionSearchFocus()) void navigate("/draft");
        return;
      }

      const index = Number(event.key) - 1;
      const item = Number.isInteger(index) ? NAV_ITEMS[index] : undefined;
      if (item) {
        event.preventDefault();
        void navigate(item.href);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);
}
