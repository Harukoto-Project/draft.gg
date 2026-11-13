import type { ReactNode } from "react";

import { AppWindow, AppWindowContent } from "@/components/ballmac/app-window";
import { AppStatusBar } from "@/components/layout/AppStatusBar";
import { AppTitleBar } from "@/components/layout/AppTitleBar";
import { useAppWindow } from "@/hooks/use-app-window";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { useSnapLayoutTarget } from "@/hooks/use-snap-layout-target";
import { useSnapshotSync } from "@/hooks/use-snapshot-sync";
import { useWindowTheme } from "@/hooks/use-window-theme";

/**
 * アプリ全体の枠。OS のタイトルバーは tauri.conf.json で外してあり、AppWindow がかわりに描く。
 * ウィンドウ自体が角を持つので、枠の角丸と境界線は消してウィンドウいっぱいに広げる。
 *
 * 面は下地(Mica か単色)の上に重ねる。枠は下地をそのまま見せ、本体だけを 1 枚の「レイヤー」として
 * 角を丸めて載せる。これが Windows 11 のアプリの標準の層構造。
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { maximized, onClose, onMinimize, onMaximize } = useAppWindow();
  useSnapLayoutTarget();
  useGlobalShortcuts();
  useSnapshotSync();
  useWindowTheme();

  return (
    <AppWindow
      maximized={maximized}
      onClose={onClose}
      onMinimize={onMinimize}
      onMaximize={onMaximize}
      className="h-svh rounded-none! border-0! bg-transparent"
    >
      <AppTitleBar />
      <AppWindowContent className="flex flex-col overflow-hidden">
        <main className="mx-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-lg border border-b-0 bg-card">
          {children}
        </main>
        <AppStatusBar />
      </AppWindowContent>
    </AppWindow>
  );
}
