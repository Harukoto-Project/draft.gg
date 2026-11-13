import { setMyPosition } from "@draftgg/shared";
import type { Position } from "@draftgg/shared";
import { useNavigate } from "react-router";

import { getDraftSnapshot, writeDraft } from "@/services/draft-storage";

/** モードを決めてドラフト画面へ進む。ロールがあればソロ、null ならチーム */
export function useStartDraft(): (position: Position | null) => void {
  const navigate = useNavigate();
  return (position) => {
    writeDraft(setMyPosition(getDraftSnapshot(), position));
    void navigate("/draft");
  };
}
