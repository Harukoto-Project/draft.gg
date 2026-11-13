import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/ballmac/i18n";
import ja from "@/messages/ja.json";

/** Ballmac の組み込み文言(ウィンドウ操作ボタンのラベルなど) */
const BALLMAC_MESSAGES = {
  "app-window.close": ja.window.close,
  "app-window.minimize": ja.window.minimize,
  "app-window.maximize": ja.window.maximize,
  "app-window.restore": ja.window.restore,
  "app-window.fullscreen": ja.window.fullscreen,
  "app-window.zoom": ja.window.zoom,
};

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <I18nProvider locale="ja" messages={BALLMAC_MESSAGES}>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
