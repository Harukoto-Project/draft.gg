import { useCallback, useSyncExternalStore } from "react";

import {
  clampInspectorWidth,
  DEFAULT_INSPECTOR_LAYOUT,
  getInspectorLayout,
  subscribeInspectorLayout,
  writeInspectorLayout,
} from "@/services/inspector-layout-storage";

export function useInspectorLayout() {
  const layout = useSyncExternalStore(
    subscribeInspectorLayout,
    getInspectorLayout,
    () => DEFAULT_INSPECTOR_LAYOUT,
  );

  const setOpen = useCallback((open: boolean) => {
    writeInspectorLayout({ ...getInspectorLayout(), open });
  }, []);
  const toggle = useCallback(() => {
    const current = getInspectorLayout();
    writeInspectorLayout({ ...current, open: !current.open });
  }, []);
  const setWidth = useCallback((width: number) => {
    writeInspectorLayout({ ...getInspectorLayout(), width: clampInspectorWidth(width) });
  }, []);

  return { ...layout, setOpen, toggle, setWidth };
}
