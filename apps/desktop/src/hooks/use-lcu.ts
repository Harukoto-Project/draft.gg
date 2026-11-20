import { useContext } from "react";

import { LcuContext } from "@/contexts/LcuContext";
import type { LcuContextValue } from "@/contexts/LcuContext";

export function useLcu(): LcuContextValue {
  const value = useContext(LcuContext);
  if (!value) {
    throw new Error("LcuProvider の中で使ってください");
  }
  return value;
}
