import type { Metadata } from "next";

import { DraftScreen } from "@/components/draft/DraftScreen";
import ja from "@/messages/ja.json";

export const metadata: Metadata = {
  title: ja.draft.title,
};

export default function DraftPage() {
  return <DraftScreen />;
}
