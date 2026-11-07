import type { ReactNode } from "react";

import { AppFooter } from "@/components/layout/AppFooter";
import { AppHeader } from "@/components/layout/AppHeader";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-svh min-h-0 flex-col">
      <AppHeader />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      <AppFooter />
    </div>
  );
}
