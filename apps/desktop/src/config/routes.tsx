import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { DraftPage } from "@/pages/DraftPage";
import { ProPage } from "@/pages/ProPage";
import { SettingsPage } from "@/pages/SettingsPage";

export interface AppRoute {
  path: string;
  element: ReactNode;
}

/** 画面の登録マップ。新しい画面は、pages/ に置いてここへ追加する(ナビゲーションは config/navigation.ts) */
export const APP_ROUTES: readonly AppRoute[] = [
  // ホームは持たず、起動したらドラフト盤面を出す(ソロ/チームの切り替えは推薦パネルのロール選択)
  { path: "/", element: <Navigate to="/draft" replace /> },
  { path: "/draft", element: <DraftPage /> },
  { path: "/pro", element: <ProPage /> },
  { path: "/settings", element: <SettingsPage /> },
];
