import { limitWith } from "../src/limiter.js";
import { fc, it } from "@fast-check/jest";
import { jest } from "@jest/globals";
import {
  RateLimiterMemory,
  RateLimiterQueue,
  RateLimiterRedis,
} from "rate-limiter-flexible";
import { Redis } from "ioredis";

import { redisConfigFromEnvironment } from "./util/fixtures.js";
import { delay } from "./util/timers.js";
import {
  maxSupportedPeriod_s,
  RateLimiterParamConstraints,
  RateLimiterParams,
  rateLimiterParams,
} from "./util/generators.js";

describe("limitWith", () => {
  const supportedParamRanges: RateLimiterParamConstraints = {
    duration: { min: 2, max: maxSupportedPeriod_s, noDefaultInfinity: true },
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
      for (let i = 0; i < params.points; i++) {
        promises.push(g());
      }
      await Promise.all(promises);
      expect(f).toHaveBeenCalledTimes(params.points);
    },
  );

  it.prop([rateLimiterParams(supportedParamRanges)])(
    "should wait if called more than N times in T seconds",
    async (params: RateLimiterParams) => {
      const f = jest.fn<() => Promise<number>>().mockResolvedValue(1);
      const g = limitWith(testQueue(params))(f);
      const promises = [];
      for (let i = 0; i < params.points; i++) {
        promises.push(g());
      }
      await jest.advanceTimersByTimeAsync(1);
      expect(f).toHaveBeenCalledTimes(params.points);
      f.mockClear();
      const p = g();
      await jest.advanceTimersByTimeAsync(1);
      expect(f).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(params.duration * 1000 + 100);
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

  it("should work with real timers.ts", async () => {
    const promises = [];
    const f = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const params = {
      points: 5,
      duration: 1,
      maxQueueLength: 1,
    };
    jest.useRealTimers();
    try {
      const g = limitWith(testQueue(params))(f);
      for (let i = 0; i < params.points; i++) {
        promises.push(g());
      }
      await delay(0);
      expect(f).toHaveBeenCalledTimes(params.points);
      f.mockClear();
      const p = g();
      await delay(0);
      expect(f).not.toHaveBeenCalled();
      await delay(params.duration * 1000 + 100);
      expect(f).toHaveBeenCalled();
      await p;
    } finally {
      jest.useFakeTimers();
      await Promise.all(promises);
    }
  });
});

describe("Overrun limiter", () => {
  const keyPrefix = `limiter:limiter-tests:overrun-limiter`;
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis(redisConfigFromEnvironment());
  });

  afterAll(async () => {
    if (redis.status !== "close" && redis.status !== "end") {
      await redis.del(`${keyPrefix}:*`);
      redis.disconnect();
    }
  });

  it("should enforce with Redis", async () => {
    const testKey = "should-enforce-with-redis";
    const duration_s = 2;
    const limiter = new RateLimiterRedis({
      storeClient: redis,
      points: 2,
      duration: duration_s,
      keyPrefix,
    });
    await expect(limiter.consume(testKey, 1)).resolves.toBeDefined();
    await expect(limiter.consume(testKey, 1)).resolves.toBeDefined();
    await expect(limiter.consume(testKey, 1)).rejects.toBeDefined();
    await delay(duration_s * 1000 + 100);
    await expect(limiter.consume(testKey, 1)).resolves.toBeDefined();
  });

  it('should work with "get"', async () => {
    const limiter = new RateLimiterRedis({
      storeClient: redis,
      points: 2,
      duration: 2,
      keyPrefix,
    });
    const testKey = "should-work-with-get";
    await limiter.consume(testKey, 1);
    expect(await limiter.get(testKey)).toEqual(
      expect.objectContaining({
        consumedPoints: 1,
      }),
    );
  });
});

function testQueue(params: RateLimiterParams) {
  const limiter = new RateLimiterMemory({
    points: params.points,
    duration: params.duration,
  });
  return new RateLimiterQueue(limiter, {
    maxQueueSize: params.maxQueueLength,
  });
}
