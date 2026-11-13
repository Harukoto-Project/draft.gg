import { Swords } from "lucide-react";
import { Link, useLocation } from "react-router";

import { AppWindowTitleBar } from "@/components/ballmac/app-window";
import { ThemeMenu } from "@/components/layout/ThemeMenu";
import { NAV_ITEMS, navItemForPath } from "@/config/navigation";
import { useFeel } from "@/lib/ballmac/feel";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

/**
 * タイトルバー。ウィンドウ操作ボタンは AppWindow が OS に合わせて描く。
 * ページ切り替えはタイトルバーの中に置き、本体の縦幅を広く使う。
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
      icon={windows ? <Swords className="text-gold" /> : undefined}
      leading={
        <>
          {windows ? null : (
            <Link to="/" className="me-2 text-sm font-semibold text-gold">
              {ja.app.title}
            </Link>
          )}
          <nav
            aria-label={ja.nav.label}
            className="flex h-[var(--bm-titlebar-h,2.5rem)] items-stretch gap-1"
          >
            {NAV_ITEMS.map((item) => {
              const current = currentHref === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "flex items-center border-b-2 px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-inset",
                    current
                      ? "border-gold text-gold"
                      : "border-transparent text-masthead-foreground/75 hover:bg-white/5 hover:text-gold",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </>
      }
      // ウィンドウ操作ボタンの色(foreground)を、暗いマストヘッド上で読める色に差し替える
      className="border-b-0 bg-masthead font-chrome text-masthead-foreground [--foreground:var(--masthead-foreground)]"
    >
      <ThemeMenu />
    </AppWindowTitleBar>
  );
}
