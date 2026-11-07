import type { Metadata } from "next";

import { SettingsScreen } from "@/components/settings/SettingsScreen";
import ja from "@/messages/ja.json";

export const metadata: Metadata = {
  title: ja.settings.title,
};

export default function SettingsPage() {
  return <SettingsScreen />;
}
