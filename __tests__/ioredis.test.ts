import { Redis, RedisOptions } from "ioredis";
import { it } from "@fast-check/jest";

describe("ioredis", () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis(redisConfigFromEnvironment());
  });

  afterAll(() => {
    if (redis.status !== "close" && redis.status !== "end") {
      redis.disconnect();
    }
  });

  it("should connect", async () => {
    await redis.set("hello", "Hello\nWorld");
    try {
      await expect(redis.get("hello")).resolves.toEqual("Hello\nWorld");
    } finally {
      await redis.del("hello");
    }
  });

  it("should allow deleting nonexistent key", async () => {
    await expect(redis.del("no-such-key")).resolves.toBeDefined();
  });
});

export function redisConfigFromEnvironment(): RedisOptions {
  return {
    host: process.env.REDIS_HOST,
    port:
      process.env.REDIS_PORT !== undefined
        ? parseInt(process.env.REDIS_PORT, 10)
        : undefined,
    username: process.env.REDIS_USER,
    password: process.env.REDIS_PASSWORD,
    connectTimeout: 2000, // ms
  };
}
