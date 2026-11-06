import type { Metadata } from "next";
import type { ReactNode } from "react";

import ja from "@/messages/ja.json";

export const metadata: Metadata = {
  title: ja.app.title,
  description: ja.app.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
