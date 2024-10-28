import { Redis } from "ioredis";
import { it } from "@fast-check/jest";
import { redisConfigFromEnvironment } from "./util/fixtures.js";

describe("ioredis", () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis(
      redisConfigFromEnvironment("limiter:limiter-tests:ioredis"),
    );
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
