import { BAN_FACTORS, PICK_FACTORS } from "@draftgg/shared";
import type { Preset } from "@draftgg/shared";

import { WeightGroup } from "@/components/settings/WeightGroup";
import { Button } from "@/components/ui/button";
import { useWeightOverrides } from "@/hooks/use-weights";
import {
  defaultWeights,
  hasOverrides,
  resetPreset,
  resolveWeights,
  setWeight,
} from "@/lib/weights";
import ja from "@/messages/ja.json";

/** 1 つのプリセット(ソロ/チーム)の重みを調整する */
export function PresetWeights({ preset }: { preset: Preset }) {
  const { overrides, setOverrides } = useWeightOverrides();
  const current = resolveWeights(preset, overrides);
  const defaults = defaultWeights(preset);
  const presetLabel = ja.settings.presets[preset];

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-4 first-of-type:border-t-0 first-of-type:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">{presetLabel}</h2>
          <p className="text-xs text-muted-foreground">{ja.settings.presetDescriptions[preset]}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasOverrides(overrides, preset)}
          onClick={() => setOverrides(resetPreset(overrides, preset))}
        >
          {ja.settings.reset}
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <WeightGroup
          title={ja.settings.pick}
          presetLabel={presetLabel}
          factors={PICK_FACTORS}
          values={current.pick}
          defaults={defaults.pick}
          onChange={(factor, value) =>
            setOverrides(setWeight(overrides, preset, "pick", factor, value))
          }
        />
        <WeightGroup
          title={ja.settings.ban}
          presetLabel={presetLabel}
          factors={BAN_FACTORS}
          values={current.ban}
          defaults={defaults.ban}
          onChange={(factor, value) =>
            setOverrides(setWeight(overrides, preset, "ban", factor, value))
          }
        />
      </div>
    </section>
  );
}
