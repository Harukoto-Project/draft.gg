import ja from "@/messages/ja.json";

export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/draft", label: ja.nav.draft },
  { href: "/pro", label: ja.nav.pro },
  { href: "/profiles", label: ja.nav.profiles },
  { href: "/teams", label: ja.nav.teams },
  { href: "/settings", label: ja.nav.settings },
];

export function navItemForPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
