import type {
  IRateLimiterOptions,
  IRateLimiterQueueOpts,
  RateLimiterAbstract,
} from "rate-limiter-flexible";
import { RateLimiterMemory, RateLimiterQueue } from "rate-limiter-flexible";
import fc, { type Arbitrary } from "fast-check";

export function number(): Arbitrary<number> {
  return fc.oneof(fc.integer(), fc.double());
}

export function rateLimiter(): Arbitrary<RateLimiterAbstract> {
  return fc
    .record<IRateLimiterOptions>({
      keyPrefix: fc.option(fc.string(), { nil: undefined }),
      points: fc.option(number(), { nil: undefined }),
      duration: fc.option(number(), { nil: undefined }),
      execEvenly: fc.option(fc.boolean(), { nil: undefined }),
      execEvenlyMinDelayMs: fc.option(number(), { nil: undefined }),
      blockDuration: fc.option(number(), { nil: undefined }),
    })
    .map(removeUndefined)
    .map((opts) => new RateLimiterMemory(opts));
}

export function rateLimiterQueue(): Arbitrary<RateLimiterQueue> {
  const queueOpts: Arbitrary<IRateLimiterQueueOpts> = fc
    .record({
      maxQueueSize: fc.option(number(), { nil: undefined }),
    })
    .map(removeUndefined);
  return fc
    .tuple<
      [RateLimiterAbstract, IRateLimiterQueueOpts | undefined]
    >(rateLimiter(), fc.option<IRateLimiterQueueOpts, undefined>(queueOpts, { nil: undefined }))
    .map(([limiter, opts]) => {
      return opts === undefined
        ? new RateLimiterQueue(limiter)
        : new RateLimiterQueue(limiter, opts);
    });
}

function removeUndefined<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined),
  ) as T;
}
