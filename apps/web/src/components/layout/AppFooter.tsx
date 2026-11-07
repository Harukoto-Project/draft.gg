import ja from "@/messages/ja.json";

export function AppFooter() {
  return (
    <footer className="shrink-0 space-y-1 border-t border-border bg-sidebar px-4 py-2 text-xs text-muted-foreground">
      <p>{ja.footer.riot}</p>
      <p>{ja.footer.sources}</p>
    </footer>
  );
}
