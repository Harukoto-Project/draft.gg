import "@fontsource-variable/noto-sans-jp";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/App";
import "@/globals.css";
import { initWindowFeel } from "@/lib/platform";
import { loadBackdrop } from "@/services/backdrop";

initWindowFeel();

// Mica が使えるときだけ下地を透明にする。決まるまで描画を待ち、単色から透明への切り替わりを見せない
if ((await loadBackdrop()) === "mica") {
  document.documentElement.setAttribute("data-backdrop", "mica");
}

const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
