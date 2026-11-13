import type { ReactNode } from "react";

import { DraftPage } from "@/pages/DraftPage";
import { HomePage } from "@/pages/HomePage";
import { ProPage } from "@/pages/ProPage";
import { SettingsPage } from "@/pages/SettingsPage";

export interface AppRoute {
  path: string;
  element: ReactNode;
}

/** 画面の登録マップ。新しい画面は、pages/ に置いてここへ追加する(ナビゲーションは config/navigation.ts) */
export const APP_ROUTES: readonly AppRoute[] = [
  { path: "/", element: <HomePage /> },
  { path: "/draft", element: <DraftPage /> },
  { path: "/pro", element: <ProPage /> },
  { path: "/settings", element: <SettingsPage /> },
];
