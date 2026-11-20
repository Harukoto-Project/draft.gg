import { Swords } from "lucide-react";
import { Link, useLocation } from "react-router";

import { AppWindowTitleBar } from "@/components/ballmac/app-window";
import { ThemeMenu } from "@/components/layout/ThemeMenu";
import { NAV_ITEMS, navItemForPath } from "@/config/navigation";
import { useFeel } from "@/lib/ballmac/feel";
import { modifierKeyLabel } from "@/lib/platform";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

/**
 * タイトルバー。ウィンドウ操作ボタンは AppWindow が OS に合わせて描く。
 * ページ切り替えはタイトルバーの中に置き、本体の縦幅を広く使う。
 * 背景は塗らず、Mica(使えないときは下地の単色)をそのまま見せる。
 */
export function AppTitleBar() {
  const { pathname } = useLocation();
  const { feel } = useFeel();
  const windows = feel === "windows";
  const currentHref = navItemForPath(pathname)?.href;

  return (
    <AppWindowTitleBar
      // Windows は左端にアイコンとタイトル。macOS と web は、中央タイトルがナビと重ならないようブランドをナビの前に置く
      title={windows ? ja.app.title : undefined}
      icon={windows ? <Swords className="text-selection" /> : undefined}
      leading={
        <>
          {windows ? null : (
            <Link to="/draft" className="me-2 text-sm font-semibold text-foreground">
              {ja.app.title}
            </Link>
          )}
          <nav
            aria-label={ja.nav.label}
            className={cn("flex h-full items-center gap-1", windows && "ms-4")}
          >
            {NAV_ITEMS.map((item, index) => {
              const current = currentHref === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-current={current ? "page" : undefined}
                  aria-keyshortcuts={`Control+${index + 1} Meta+${index + 1}`}
                  title={`${item.label} (${modifierKeyLabel()}${index + 1})`}
                  className={cn(
                    "relative flex h-7 items-center rounded-xs px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    current
                      ? "bg-foreground/[0.06] font-medium text-foreground"
                      : "text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground",
                  )}
                >
                  {item.label}
                  {current ? (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full bg-selection"
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </>
      }
      className="h-9 border-b-0 bg-transparent font-chrome text-foreground"
    >
      <ThemeMenu />
    </AppWindowTitleBar>
  );
}
