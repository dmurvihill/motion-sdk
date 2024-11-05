import { Redis, RedisOptions } from "ioredis";
import {
  Motion,
  MotionOptions,
  recommendedRateLimits,
} from "../../src/index.js";
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
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

/* WARNING. Make sure you are using the same Redis server and limiter
keys _everywhere_ you are calling the real Motion API. */
export async function motionClientFromEnvironment(
  redis: Redis,
  baseUrl?: string,
): Promise<Motion> {
  baseUrl = baseUrl ?? process.env.MOTION_TEST_TARGET ?? motionMockBaseUrl;
  const keyPrefix = `limiter:${baseUrl.replace(/:/g, "")}`;
  const requestLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    ...recommendedRateLimits.requests,
  });
  const overrunLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    ...recommendedRateLimits.overruns,
  });
  const apiKey = process.env.MOTION_API_KEY ?? "";
  const userId = process.env.MOTION_USER_ID ?? "";
  const motion = new Motion({
    baseUrl,
    apiKey,
    userId,
    requestLimiter,
    overrunLimiter,
  });
  if (apiKey === "") {
    motion.close(
      "API key not set; set the MOTION_API_KEY environment variable",
    );
  } else if (userId === "") {
    motion.close(
      "User ID not set; set the MOTION_USER_ID environment variable",
    );
  } else {
    const limiterCheck = overrunLimiter
      .get(motion.overrunLimiterKey)
      .catch((e: unknown) => {
        motion.close("Unable to get overrun limiter status; refusing to start");
        console.error(e);
        throw e;
      });
    const overrunsToday = (await limiterCheck)?.consumedPoints ?? 0;
    if (overrunsToday > 0) {
      motion.close("Already had an overrun today; refusing to start");
    }
  }

  return motion;
}
