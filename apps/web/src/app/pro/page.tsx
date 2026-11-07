import type { Metadata } from "next";

import { ProStatsScreen } from "@/components/pro/ProStatsScreen";
import ja from "@/messages/ja.json";

export const metadata: Metadata = {
  title: ja.pro.title,
};

export default function ProPage() {
  return <ProStatsScreen />;
}
