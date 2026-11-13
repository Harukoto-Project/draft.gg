import type { ReactNode } from "react";

import { AppWindow, AppWindowContent } from "@/components/ballmac/app-window";
import { AppStatusBar } from "@/components/layout/AppStatusBar";
import { AppTitleBar } from "@/components/layout/AppTitleBar";
import { useAppWindow } from "@/hooks/use-app-window";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { useSnapLayoutTarget } from "@/hooks/use-snap-layout-target";

/**
 * アプリ全体の枠。OS のタイトルバーは tauri.conf.json で外してあり、AppWindow がかわりに描く。
 * ウィンドウ自体が角を持つので、枠の角丸と境界線は消してウィンドウいっぱいに広げる。
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { maximized, onClose, onMinimize, onMaximize } = useAppWindow();
  useSnapLayoutTarget();
  useGlobalShortcuts();

  return (
    <AppWindow
      maximized={maximized}
      onClose={onClose}
      onMinimize={onMinimize}
      onMaximize={onMaximize}
      className="h-svh rounded-none! border-0!"
    >
      <AppTitleBar />
      <AppWindowContent className="flex flex-col overflow-hidden">
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        <AppStatusBar />
      </AppWindowContent>
    </AppWindow>
  );
}
