import { RedisOptions } from "ioredis";
import {
  Motion,
  MotionOptions,
  recommendedRateLimits,
} from "../../src/index.js";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { motionMockBaseUrl } from "../../src/constant.js";

export function redisConfigFromEnvironment(keyPrefix?: string): RedisOptions {
  const username = process.env.REDIS_USER ?? "no-username";
  return {
    host: process.env.REDIS_HOST,
    port:
      process.env.REDIS_PORT !== undefined
        ? parseInt(process.env.REDIS_PORT, 10)
        : undefined,
    username,
    password: process.env.REDIS_PASSWORD,
    connectTimeout: 2000, // ms
    enableReadyCheck: false,
    keyPrefix,
  };
}

export function inMemoryTestClient(opts: Partial<MotionOptions> = {}) {
  return new Motion(
    Object.assign(
      {
        baseUrl: motionMockBaseUrl,
        userId: "testUserId",
        apiKey: "testApiKey",
        requestLimiter: new RateLimiterMemory(recommendedRateLimits.requests),
        overrunLimiter: new RateLimiterMemory(recommendedRateLimits.overruns),
      },
      opts,
    ),
  );
}
