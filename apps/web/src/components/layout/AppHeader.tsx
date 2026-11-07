"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeMenu } from "@/components/layout/ThemeMenu";
import { UserMenu } from "@/components/layout/UserMenu";
import { NAV_ITEMS, navItemForPath } from "@/config/navigation";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

export function AppHeader() {
  const pathname = usePathname();
  const currentHref = navItemForPath(pathname)?.href;

  return (
    <header className="flex h-14 shrink-0 items-center gap-6 bg-masthead px-4 text-masthead-foreground">
      <Link href="/draft" className="font-semibold text-gold">
        {ja.app.title}
      </Link>
      <nav aria-label={ja.nav.label} className="flex h-full items-stretch gap-4">
        {NAV_ITEMS.map((item) => {
          const current = currentHref === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex items-center border-b-2 text-sm",
                current ? "border-gold text-gold" : "border-transparent hover:text-gold",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-1">
        <UserMenu />
        <ThemeMenu />
      </div>
    </header>
  );
}
