import { Motion } from "../src/index.js";
import { closedErrorType } from "../src/constant.js";
import {
  motionClientFromEnvironment,
  redisConfigFromEnvironment,
} from "./util/fixtures.js";
import { Redis } from "ioredis";
import { expectMotionError, expectResponse } from "./util/assertions.js";

describe("Motion", () => {
  let motion: Motion;
  const redis = new Redis(redisConfigFromEnvironment());

  beforeAll(async () => {
    motion = await motionClientFromEnvironment(redis);
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
      motionForCloseTests = await motionClientFromEnvironment(redis);
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
});
