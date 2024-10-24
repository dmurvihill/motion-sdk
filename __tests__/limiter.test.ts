import { limitWith } from "../src/limiter.js";
import { fc, it } from "@fast-check/jest";
import { jest } from "@jest/globals";
import { Arbitrary, DoubleConstraints, IntegerConstraints } from "fast-check";
import {
  RateLimiterMemory,
  RateLimiterQueue,
  RateLimiterRedis,
} from "rate-limiter-flexible";
import { Redis } from "ioredis";
import { redisConfigFromEnvironment } from "./ioredis.test.js";

const maxSupportedPeriod_s = 60 * 60 * 24; // about a day
const maxSupportedLimit = 1000;
const maxSupportedQueueLength = 1000;

describe("QueuedRateLimiter", () => {
  const supportedParamRanges: RateLimiterParamConstraints = {
    period_s: { min: 2, max: maxSupportedPeriod_s, noDefaultInfinity: true },
    maxQueueLength: { min: 1 },
  };

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it.prop([rateLimiterParams()])(
    "should work if called no more than N times in T seconds",
    async (params: RateLimiterParams) => {
      const f = jest.fn<() => Promise<number>>().mockResolvedValue(1);
      const g = limitWith(testQueue(params))(f);
      const promises = [];
      for (let i = 0; i < params.limit; i++) {
        promises.push(g());
      }
      await Promise.all(promises);
      expect(f).toHaveBeenCalledTimes(params.limit);
    },
  );

  it.prop([rateLimiterParams(supportedParamRanges)])(
    "should wait if called more than N times in T seconds",
    async (params: RateLimiterParams) => {
      const f = jest.fn<() => Promise<number>>().mockResolvedValue(1);
      const g = limitWith(testQueue(params))(f);
      const promises = [];
      for (let i = 0; i < params.limit; i++) {
        promises.push(g());
      }
      await jest.advanceTimersByTimeAsync(1);
      expect(f).toHaveBeenCalledTimes(params.limit);
      f.mockClear();
      const p = g();
      await jest.advanceTimersByTimeAsync(1);
      expect(f).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(params.period_s * 1000 + 100);
      expect(f).toHaveBeenCalled();
      await p;
      await Promise.all(promises);
    },
  );

  it.prop([rateLimiterParams(supportedParamRanges), fc.nat()])(
    "should wrap non-promises",
    async (params: RateLimiterParams, result: number) => {
      const f = jest.fn().mockReturnValue(result);
      const g = limitWith(testQueue(params))(f);
      await expect(g()).resolves.toBe(result);
    },
  );

  it.prop([rateLimiterParams(supportedParamRanges), fc.nat()])(
    "should 'then' promises",
    async (params: RateLimiterParams, result: number) => {
      const f = jest.fn<() => Promise<number>>().mockResolvedValue(result);
      const g = limitWith(testQueue(params))(f);
      await expect(g()).resolves.toBe(result);
    },
  );

  it("should work with real timers", async () => {
    const promises = [];
    const f = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const params = {
      limit: 5,
      period_s: 1,
      maxQueueLength: 1,
    };
    jest.useRealTimers();
    try {
      const g = limitWith(testQueue(params))(f);
      for (let i = 0; i < params.limit; i++) {
        promises.push(g());
      }
      await delay(0);
      expect(f).toHaveBeenCalledTimes(params.limit);
      f.mockClear();
      const p = g();
      await delay(0);
      expect(f).not.toHaveBeenCalled();
      await delay(params.period_s * 1000 + 100);
      expect(f).toHaveBeenCalled();
      await p;
    } finally {
      jest.useFakeTimers();
      await Promise.all(promises);
    }
  });
});

describe("Overrun limiter", () => {
  const overrunLimiterTestKey = "overrun_limiter_test";
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis(
      redisConfigFromEnvironment("motion-sdk-tests:overrun-limiter"),
    );
  });

  afterAll(async () => {
    if (redis.status !== "close" && redis.status !== "end") {
      await redis.del(overrunLimiterTestKey);
      redis.disconnect();
    }
  });

  it("should enforce with Redis", async () => {
    const duration_s = 1;
    const limiter = new RateLimiterRedis({
      storeClient: redis,
      points: 2,
      duration: duration_s,
    });
    await expect(
      limiter.consume(overrunLimiterTestKey, 1),
    ).resolves.toBeDefined();
    await expect(
      limiter.consume(overrunLimiterTestKey, 1),
    ).resolves.toBeDefined();
    await expect(
      limiter.consume(overrunLimiterTestKey, 1),
    ).rejects.toBeDefined();
    await delay(duration_s * 1000 + 100);
    await expect(
      limiter.consume(overrunLimiterTestKey, 1),
    ).resolves.toBeDefined();
  });
});

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RateLimiterParams {
  readonly limit: number;
  readonly period_s: number;
  readonly maxQueueLength: number;
}

interface RateLimiterParamConstraints {
  limit?: IntegerConstraints;
  period_s?: DoubleConstraints;
  maxQueueLength?: IntegerConstraints;
}

function rateLimiterParams(
  constraints?: RateLimiterParamConstraints,
): Arbitrary<RateLimiterParams> {
  const limit = fc.integer(
    Object.assign({ min: 1, max: maxSupportedLimit }, constraints?.limit ?? {}),
  );
  const period_s = fc.double(
    Object.assign(
      { max: maxSupportedPeriod_s, noNaN: true },
      constraints?.period_s ?? {},
    ),
  );
  const maxQueueLength = fc.integer(
    Object.assign(
      { min: 0, max: maxSupportedQueueLength },
      constraints?.maxQueueLength ?? {},
    ),
  );
  return fc.record({
    limit,
    period_s,
    maxQueueLength,
  });
}

function testQueue(params: RateLimiterParams) {
  const limiter = new RateLimiterMemory({
    points: params.limit,
    duration: params.period_s,
  });
  return new RateLimiterQueue(limiter, {
    maxQueueSize: params.maxQueueLength,
  });
}
