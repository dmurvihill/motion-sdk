import { Arbitrary, DoubleConstraints, IntegerConstraints } from "fast-check";
import { fc } from "@fast-check/jest";

export const maxSupportedPeriod_s = 60 * 60 * 24; // about a day
const maxSupportedLimit = 1000;
const maxSupportedQueueLength = 1000;

export interface RateLimiterParams {
  readonly points: number;
  readonly duration: number;
  readonly maxQueueLength: number;
}

export interface RateLimiterParamConstraints {
  points?: IntegerConstraints;
  duration?: DoubleConstraints;
  maxQueueLength?: IntegerConstraints;
}

export function rateLimiterParams(
  constraints?: RateLimiterParamConstraints,
): Arbitrary<RateLimiterParams> {
  const limit = fc.integer(
    Object.assign(
      { min: 1, max: maxSupportedLimit },
      constraints?.points ?? {},
    ),
  );
  const period_s = fc.double(
    Object.assign(
      { max: maxSupportedPeriod_s, noNaN: true },
      constraints?.duration ?? {},
    ),
  );
  const maxQueueLength = fc.integer(
    Object.assign(
      { min: 0, max: maxSupportedQueueLength },
      constraints?.maxQueueLength ?? {},
    ),
  );
  return fc.record({
    points: limit,
    duration: period_s,
    maxQueueLength,
  });
}
