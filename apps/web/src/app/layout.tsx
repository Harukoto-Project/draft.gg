import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { Providers } from "@/components/layout/Providers";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

import "./globals.css";

const sans = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: ja.app.title,
    template: `%s | ${ja.app.title}`,
  },
  description: ja.app.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" className={cn(sans.variable, "font-sans")} suppressHydrationWarning>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
