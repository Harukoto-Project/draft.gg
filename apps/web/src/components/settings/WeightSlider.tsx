"use client";

import { WEIGHT_MAX, WEIGHT_STEP } from "@/lib/weights";
import ja from "@/messages/ja.json";

interface WeightSliderProps {
  label: string;
  ariaLabel: string;
  value: number;
  defaultValue: number;
  /** 合計に対する割合(%) */
  share: number;
  onChange: (value: number) => void;
}

const toPercent = (value: number) => Math.round(value * 100);

/** 重み 1 つ分のスライダー。0〜100 で表す */
export function WeightSlider({
  label,
  ariaLabel,
  value,
  defaultValue,
  share,
  onChange,
}: WeightSliderProps) {
  const changed = Math.abs(value - defaultValue) > 1e-9;
  return (
    <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[7rem_1fr_9rem]">
      <span className="text-sm text-foreground">{label}</span>
      <input
        type="range"
        aria-label={ariaLabel}
        min={0}
        max={WEIGHT_MAX}
        step={WEIGHT_STEP}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-6 w-full min-w-0 accent-primary"
      />
      <span className="text-right text-xs tabular-nums text-muted-foreground">
        <span className="text-sm text-foreground">{toPercent(value)}</span>
        <span className="hidden sm:inline">
          {" "}
          · {ja.settings.share.replace("{percent}", String(share))}
        </span>
        {changed ? (
          <span className="ml-1 text-primary" title={ja.settings.customized}>
            ●<span className="sr-only">{ja.settings.customized}</span>
          </span>
        ) : null}
      </span>
    </div>
  );
}
