import { useContext } from "react";

import { DraftContext } from "@/contexts/DraftContext";
import type { DraftContextValue } from "@/contexts/DraftContext";

export function useDraft(): DraftContextValue {
  const value = useContext(DraftContext);
  if (!value) {
    throw new Error("DraftProvider の中で使ってください");
  }
  return value;
}
