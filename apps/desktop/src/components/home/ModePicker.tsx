import { POSITIONS, POSITION_LABELS } from "@draftgg/shared";

import { RoleIconButton } from "@/components/role/RoleIconButton";
import { Button } from "@/components/ui/button";
import { useStartDraft } from "@/hooks/use-start-draft";
import { formatMessage } from "@/lib/formatMessage";
import ja from "@/messages/ja.json";

/** ソロ(ロールを選ぶ)かチームかを選んで、ドラフト画面へ進む */
export function ModePicker() {
  const start = useStartDraft();

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section className="flex flex-col gap-3 border border-border bg-card p-4">
        <h3 className="text-base font-semibold text-foreground">{ja.home.solo.title}</h3>
        <p className="text-sm text-muted-foreground">{ja.home.solo.description}</p>
        <div className="mt-auto flex items-center gap-1.5">
          {POSITIONS.map((position) => (
            <RoleIconButton
              key={position}
              position={position}
              pressed={false}
              className="size-9"
              label={formatMessage(ja.home.soloRole, { role: POSITION_LABELS[position] })}
              onClick={() => start(position)}
            />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3 border border-border bg-card p-4">
        <h3 className="text-base font-semibold text-foreground">{ja.home.team.title}</h3>
        <p className="text-sm text-muted-foreground">{ja.home.team.description}</p>
        <div className="mt-auto">
          <Button size="sm" onClick={() => start(null)}>
            {ja.home.team.start}
          </Button>
        </div>
      </section>
    </div>
  );
}
