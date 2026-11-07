import type { Metadata } from "next";

import { TeamsScreen } from "@/components/team/TeamsScreen";
import ja from "@/messages/ja.json";

export const metadata: Metadata = {
  title: ja.teams.title,
};

export default function TeamsPage() {
  return <TeamsScreen />;
}
