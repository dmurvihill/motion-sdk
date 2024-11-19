import { Motion, recommendedRateLimits } from "../src/index.js";
import { Redis } from "ioredis";
import { RateLimiterRedis } from "rate-limiter-flexible";

describe("README", () => {
  it("basic example should work", async () => {
    const motion = new Motion();
    await motion.fetch("/users/me");
    motion.close("Finished with the example");
  });

  /* eslint-disable @typescript-eslint/no-unused-vars
  --
  Proper initialization is better illustrated without using the created object
  */
  it("custom rate limiter example should work", async () => {
    const redis = new Redis({
      host: process.env.REDIS_HOST,
      username: process.env.REDIS_USER,
      password: process.env.REDIS_PASS,
    });
    const requestLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rate-limit-motion",
      ...recommendedRateLimits.requests,
    });
    const overrunLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rate-limit-motion",
      ...recommendedRateLimits.requests,
    });
    const motion = new Motion({
      requestLimiter,
      overrunLimiter,
    });

    await redis.quit();
  });
  /* eslint-enable @typescript-eslint/no-unused-vars */
});
