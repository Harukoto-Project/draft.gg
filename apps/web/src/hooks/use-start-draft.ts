"use client";

import { setMyPosition } from "@draftgg/shared";
import type { Position } from "@draftgg/shared";
import { useRouter } from "next/navigation";

import { getDraftSnapshot, writeDraft } from "@/services/draft-storage";

/** モードを決めてドラフト画面へ進む。ロールがあればソロ、null ならチーム */
export function useStartDraft(): (position: Position | null) => void {
  const router = useRouter();
  return (position) => {
    writeDraft(setMyPosition(getDraftSnapshot(), position));
    router.push("/draft");
  };
}
