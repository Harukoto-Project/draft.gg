import { useTheme } from "next-themes";
import { useEffect } from "react";

import { setWindowTheme } from "@/services/backdrop";

/** アプリで選んだ明暗をウィンドウにも伝え、Mica の明暗を画面と揃える */
export function useWindowTheme(): void {
  const { theme } = useTheme();

  useEffect(() => {
    void setWindowTheme(theme);
  }, [theme]);
}
