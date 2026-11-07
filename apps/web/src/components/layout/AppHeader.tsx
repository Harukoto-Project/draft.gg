"use client";

import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { ThemeMenu } from "@/components/layout/ThemeMenu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import ja from "@/messages/ja.json";

export function AppHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 bg-sidebar px-3">
      <SidebarTrigger aria-label={ja.nav.openMenu} />
      <Separator orientation="vertical" className="h-4" />
      <AppBreadcrumb />
      <div className="ml-auto">
        <ThemeMenu />
      </div>
    </header>
  );
}
