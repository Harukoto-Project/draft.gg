import { cn } from "@/lib/utils";

/** ロールのアイコンボタンと並べる、文字のチップ(「全て」「チーム」など)。選択中はアクセント色の枠 */
export function RoleTextChip({
  pressed,
  title,
  onClick,
  children,
}: {
  pressed: boolean;
  title?: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
      className={cn(
        "h-7 shrink-0 cursor-pointer rounded-md border px-2.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        pressed
          ? "border-selection bg-selection/20 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
