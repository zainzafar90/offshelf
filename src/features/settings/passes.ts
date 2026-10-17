import { SETTING_RANGES } from "../../core/model";

const DEFAULT_PASSES = 24;

export function clampPasses(raw: string): number {
  const { min, max } = SETTING_RANGES.maxPasses;

  return Math.min(max, Math.max(min, parseInt(raw, 10) || DEFAULT_PASSES));
}
