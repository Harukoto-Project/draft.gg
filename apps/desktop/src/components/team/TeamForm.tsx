import { POSITIONS, POSITION_LABELS } from "@draftgg/shared";
import type { Position, Profile, Team, TeamInput, TeamMembers } from "@draftgg/shared";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { RoleIcon } from "@/components/role/RoleIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMessage } from "@/lib/formatMessage";
import ja from "@/messages/ja.json";

const NAME_MAX = 50;

/** チームの作成・編集フォーム。`team` があれば編集 */
export function TeamForm({
  team,
  profiles,
  pending,
  serverError,
  onSubmit,
  onCancel,
}: {
  team?: Team;
  profiles: readonly Profile[];
  pending: boolean;
  serverError: string | null;
  onSubmit: (input: TeamInput) => void;
  onCancel?: () => void;
}) {
  const nameId = useId();
  const [name, setName] = useState(team?.name ?? "");
  const [members, setMembers] = useState<TeamMembers>(team?.members ?? {});
  const [error, setError] = useState<string | null>(null);

  const usedIds = new Set(Object.values(members));

  function assign(position: Position, profileId: string) {
    setMembers((current) => {
      const next = { ...current };
      if (profileId === "") delete next[position];
      else next[position] = profileId;
      return next;
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > NAME_MAX) {
      setError(ja.teams.form.errorName);
      return;
    }
    setError(null);
    onSubmit({ name: trimmed, members });
  }

  const message = error ?? serverError;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <h2 className="text-base font-semibold text-foreground">
        {team ? ja.teams.form.editTitle : ja.teams.form.createTitle}
      </h2>
      <div className="flex flex-col gap-1">
        <label htmlFor={nameId} className="text-xs text-muted-foreground">
          {ja.teams.form.name}
        </label>
        <Input
          id={nameId}
          value={name}
          maxLength={NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          className="max-w-sm"
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs text-muted-foreground">{ja.teams.form.members}</legend>
        {POSITIONS.map((position) => {
          const current = members[position] ?? "";
          return (
            <div key={position} className="flex items-center gap-2">
              <RoleIcon position={position} className="size-5 shrink-0" />
              <select
                aria-label={formatMessage(ja.teams.form.memberLabel, {
                  role: POSITION_LABELS[position],
                })}
                value={current}
                onChange={(event) => assign(position, event.target.value)}
                className="h-8 w-full max-w-xs rounded-xs border border-input bg-background px-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">{ja.teams.form.unassigned}</option>
                {profiles.map((profile) => (
                  <option
                    key={profile.id}
                    value={profile.id}
                    // 同じプレイヤーを複数のロールには割り当てられない
                    disabled={profile.id !== current && usedIds.has(profile.id)}
                  >
                    {profile.displayName}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </fieldset>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {team ? ja.teams.form.save : ja.teams.form.create}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {ja.teams.form.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
