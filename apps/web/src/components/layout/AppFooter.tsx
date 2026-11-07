import ja from "@/messages/ja.json";

export function AppFooter() {
  return (
    <footer className="shrink-0 space-y-1 border-t border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      <p>{ja.footer.riot}</p>
      <p>{ja.footer.sources}</p>
    </footer>
  );
}
