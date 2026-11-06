export const POSITIONS = ["top", "jungle", "mid", "adc", "support"] as const;

export type Position = (typeof POSITIONS)[number];
