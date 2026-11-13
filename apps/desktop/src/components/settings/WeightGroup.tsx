import { WeightSlider } from "@/components/settings/WeightSlider";
import { weightsTotal } from "@/lib/weights";
import ja from "@/messages/ja.json";

interface WeightGroupProps<K extends string> {
  title: string;
  presetLabel: string;
  factors: readonly K[];
  values: Record<K, number>;
  defaults: Record<K, number>;
  onChange: (factor: K, value: number) => void;
}

/** ピックまたは BAN の重みを、要素ごとのスライダーで並べる */
export function WeightGroup<K extends keyof typeof ja.recommendation.factor>({
  title,
  presetLabel,
  factors,
  values,
  defaults,
  onChange,
}: WeightGroupProps<K>) {
  const total = weightsTotal(values);
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {total === 0 ? (
        <p role="alert" className="text-xs text-destructive">
          {ja.settings.allZero}
        </p>
      ) : null}
      {factors.map((factor) => {
        const label = ja.recommendation.factor[factor];
        return (
          <WeightSlider
            key={factor}
            label={label}
            ariaLabel={ja.settings.sliderLabel
              .replace("{preset}", presetLabel)
              .replace("{kind}", title)
              .replace("{factor}", label)}
            value={values[factor]}
            defaultValue={defaults[factor]}
            share={total > 0 ? Math.round((values[factor] / total) * 100) : 0}
            onChange={(value) => onChange(factor, value)}
          />
        );
      })}
    </section>
  );
}
