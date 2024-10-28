import { Motion, recommendedRateLimits } from "../src/index.js";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { closedErrorType, motionMockBaseUrl } from "../src/constant.js";
import { redisConfigFromEnvironment } from "./util/fixtures.js";
import { Redis } from "ioredis";
import { expectMotionError, expectResponse } from "./util/assertions.js";

describe("Motion", () => {
  let motion: Motion;
  const redis = new Redis(redisConfigFromEnvironment());

  beforeAll(async () => {
    motion = await motionClientFromEnvironment();
  });

  afterAll(async () => {
    motion.close("finished testing");
    await redis.quit();
  });

  describe("fetch", () => {
    const successfulGetMyUserResponse = expect.objectContaining({
      email: expect.stringMatching(/.*/), // eslint-disable-line @typescript-eslint/no-unsafe-assignment
      id: expect.stringMatching(/.*/), // eslint-disable-line @typescript-eslint/no-unsafe-assignment
      name: expect.stringMatching(/.*/), // eslint-disable-line @typescript-eslint/no-unsafe-assignment
    }) as unknown;

    it("should pass through to the API", async () => {
      const response = expectResponse(await motion.fetch("/users/me"));
      expect(await response.json()).toEqual(successfulGetMyUserResponse);
    });

    it("should accept a Headers object", async () => {
      const headers = new Headers({
        Location: "testlocation",
        "X-Api-Key": "testkey",
      });
      expectResponse(await motion.fetch("/users/me", { headers }));
    });

    it("should accept a headers tuple array", async () => {
      expectResponse(
        await motion.fetch("/users/me", {
          headers: [
            ["Location", "testlocation"],
            ["X-Api-Key", "testkey"],
          ],
        }),
      );
    });

    it("should prepend a slash to the path if needed", async () => {
      const response = expectResponse(await motion.fetch("users/me"));
      expect(await response.json()).toEqual(successfulGetMyUserResponse);
    });

    it("should deduplicate slashes in the path", async () => {
      const response = expectResponse(await motion.fetch("//users/me"));
      expect(await response.json()).toEqual(successfulGetMyUserResponse);
    });
  });

  describe("close", () => {
    let motionForCloseTests: Motion;

    beforeEach(async () => {
      motionForCloseTests = await motionClientFromEnvironment();
    });

    afterEach(() => {
      if (motionForCloseTests.isOpen()) {
        motionForCloseTests.close("left open after a test of close()");
      }
    });

    it("should set isOpen", () => {
      close();
      expect(motionForCloseTests.isOpen()).toBe(false);
    });

    it("should return ClosedError on any subsequent fetch", async () => {
      close();
      expectMotionError(
        await motionForCloseTests.fetch("/users/me"),
        closedErrorType,
      );
    });

    it("should return ClosedError on double-close", () => {
      close();
      expectMotionError(
        motionForCloseTests.close("closing again"),
        closedErrorType,
      );
    });

    function close() {
      const testName = expect.getState().currentTestName ?? "undefined";
      return motionForCloseTests.close(`testing "${testName}"`);
    }
  });

  /* Don't share this one in the util folder; too dangerous */
  async function motionClientFromEnvironment(): Promise<Motion> {
    const baseUrl = process.env.MOTION_TEST_TARGET ?? motionMockBaseUrl;
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
          motion.close("Unable to get overrun limiter status at start of test");
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
});
