import { useCallback, useEffect, useState } from "react";

import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  onWindowResized,
  toggleMaximizeWindow,
} from "@/services/window";

/** AppWindow に渡すウィンドウ状態と操作 */
export function useAppWindow() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const sync = () => {
      void isWindowMaximized().then((value) => {
        if (!disposed) setMaximized(value);
      });
    };

    sync();
    void onWindowResized(sync).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const onClose = useCallback(() => void closeWindow(), []);
  const onMinimize = useCallback(() => void minimizeWindow(), []);
  const onMaximize = useCallback(() => void toggleMaximizeWindow(), []);

  return { maximized, onClose, onMinimize, onMaximize };
}
