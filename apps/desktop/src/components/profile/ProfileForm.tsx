import { POSITIONS, RIOT_REGIONS, parseRiotId } from "@draftgg/shared";
import type { Position, Profile, ProfileInput, RiotRegion } from "@draftgg/shared";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { RoleIconButton } from "@/components/role/RoleIconButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ja from "@/messages/ja.json";

const NAME_MAX = 50;

/** 入力を ProfileInput にする。形が違えば、画面に出す文言を返す */
function toInput(values: {
  displayName: string;
  riotId: string;
  region: RiotRegion | "";
  roles: Position[];
}): { input: ProfileInput } | { error: string } {
  const displayName = values.displayName.trim();
  if (displayName.length < 1 || displayName.length > NAME_MAX) {
    return { error: ja.profiles.form.errorName };
  }
  const riotId = values.riotId.trim();
  if (riotId.length > 0 && !parseRiotId(riotId)) return { error: ja.profiles.form.errorRiotId };
  if (riotId.length > 0 && values.region === "") return { error: ja.profiles.form.errorRegion };
  return {
    input: {
      displayName,
      riotId: riotId.length > 0 ? riotId : null,
      region: riotId.length > 0 && values.region !== "" ? values.region : null,
      roles: values.roles,
    },
  };
}

/** プレイヤーの作成・編集フォーム。`profile` があれば編集 */
export function ProfileForm({
  profile,
  pending,
  serverError,
  onSubmit,
  onCancel,
}: {
  profile?: Profile;
  pending: boolean;
  serverError: string | null;
  onSubmit: (input: ProfileInput) => void;
  onCancel?: () => void;
}) {
  const ids = { name: useId(), riotId: useId(), region: useId(), hint: useId() };
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [riotId, setRiotId] = useState(profile?.riotId ?? "");
  const [region, setRegion] = useState<RiotRegion | "">(profile?.region ?? "");
  const [roles, setRoles] = useState<Position[]>(profile?.roles ?? []);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(position: Position) {
    setRoles((current) =>
      current.includes(position)
        ? current.filter((role) => role !== position)
        : POSITIONS.filter((role) => role === position || current.includes(role)),
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = toInput({ displayName, riotId, region, roles });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    onSubmit(result.input);
  }

  const message = error ?? serverError;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <h2 className="text-base font-semibold text-foreground">
        {profile ? ja.profiles.form.editTitle : ja.profiles.form.createTitle}
      </h2>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.name} className="text-xs text-muted-foreground">
          {ja.profiles.form.displayName}
        </label>
        <Input
          id={ids.name}
          value={displayName}
          maxLength={NAME_MAX}
          onChange={(event) => setDisplayName(event.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.riotId} className="text-xs text-muted-foreground">
            {ja.profiles.form.riotId}
          </label>
          <Input
            id={ids.riotId}
            value={riotId}
            placeholder={ja.profiles.form.riotIdPlaceholder}
            aria-describedby={ids.hint}
            autoComplete="off"
            onChange={(event) => setRiotId(event.target.value)}
            className="w-56"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.region} className="text-xs text-muted-foreground">
            {ja.profiles.form.region}
          </label>
          <select
            id={ids.region}
            value={region}
            onChange={(event) => setRegion(event.target.value as RiotRegion | "")}
            className="h-8 rounded-xs border border-input bg-background px-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">{ja.profiles.form.regionNone}</option>
            {RIOT_REGIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p id={ids.hint} className="-mt-2 text-xs text-muted-foreground">
        {ja.profiles.form.riotIdHint}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{ja.profiles.form.roles}</span>
        <div role="group" aria-label={ja.profiles.form.roles} className="flex items-center gap-1">
          {POSITIONS.map((position) => (
            <RoleIconButton
              key={position}
              position={position}
              pressed={roles.includes(position)}
              onClick={() => toggleRole(position)}
            />
          ))}
        </div>
      </div>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {profile ? ja.profiles.form.save : ja.profiles.form.create}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {ja.profiles.form.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
