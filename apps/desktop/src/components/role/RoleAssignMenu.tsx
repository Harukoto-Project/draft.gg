import { POSITIONS, POSITION_LABELS } from "@draftgg/shared";
import type { Position } from "@draftgg/shared";
import { CircleDashed } from "lucide-react";

import { RoleIcon } from "@/components/role/RoleIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

/**
 * ピックしたチャンピオンのロールを選ぶボタン。いまのロールのアイコンを出し、押すと 5 ロールのメニューを開く。
 * 幅の狭いピック枠でも 24px 四方で収まる。
 */
export function RoleAssignMenu({
  position,
  disabled,
  label,
  onChange,
  className,
}: {
  position: Position | null;
  disabled?: boolean;
  /** 読み上げ用。対象の枠を含めて渡す */
  label: string;
  onChange: (position: Position | null) => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={position ? POSITION_LABELS[position] : ja.draft.roleUnset}
          disabled={disabled}
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-sm bg-black/55 text-white/80 outline-none transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-0",
            className,
          )}
        >
          {position ? (
            <RoleIcon position={position} className="size-4" />
          ) : (
            <CircleDashed aria-hidden="true" className="size-4" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup
          value={position ?? ""}
          onValueChange={(value) => {
            const next = POSITIONS.find((item) => item === value);
            if (next) onChange(next);
          }}
        >
          {POSITIONS.map((item) => (
            <DropdownMenuRadioItem key={item} value={item}>
              <RoleIcon position={item} className="size-4" />
              {POSITION_LABELS[item]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {position ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(null)}>
              {ja.draft.roleClear}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
