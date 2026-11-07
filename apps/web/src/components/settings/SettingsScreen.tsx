"use client";

import { PRESETS } from "@draftgg/shared";

import { PresetWeights } from "@/components/settings/PresetWeights";
import ja from "@/messages/ja.json";

export function SettingsScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
      <div className="flex max-w-2xl flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">{ja.settings.title}</h1>
        <p className="text-xs text-muted-foreground">{ja.settings.description}</p>
      </div>
      <p className="max-w-2xl text-xs text-muted-foreground">{ja.settings.weightsNote}</p>
      {PRESETS.map((preset) => (
        <PresetWeights key={preset} preset={preset} />
      ))}
      <dl className="flex flex-wrap items-baseline gap-x-3 text-sm">
        <dt className="text-muted-foreground">{ja.settings.tierTitle}</dt>
        <dd className="text-foreground">{ja.settings.tierValue}</dd>
        <dd className="text-xs text-muted-foreground">{ja.settings.tierNote}</dd>
      </dl>
    </div>
  );
}
