import fetchMock, { RouteResponse } from "fetch-mock";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { jest } from "@jest/globals";
import { it, fc } from "@fast-check/jest";
import { expectMotionError, expectResponse } from "./util/assertions.js";
import { inMemoryTestClient } from "./util/fixtures.js";
import Motion from "../src/motion.js";
import {
  closedErrorType,
  fetchErrorType,
  argumentErrorType,
  limiterErrorType,
  limitExceededErrorType,
  motionBaseUrl,
  motionMockBaseUrl,
  queueOverflowErrorType,
  recommendedRateLimits,
} from "../src/constant.js";

const baseUrl = motionMockBaseUrl;
const mockPath = "/some_path";
const limitExceededError = {
  message: "Rate limit exceeded. Consult docs for rate limit information",
};

describe("Motion", () => {
  beforeAll(() => {
    fetchMock.mockGlobal();
  });

  afterEach(() => {
    fetchMock.removeRoutes();
    fetchMock.clearHistory();
  });

  afterAll(() => {
    fetchMock.unmockGlobal();
  });

  it("should give a basic client with no arguments", async () => {
    fetchMock.get(`${motionBaseUrl}${mockPath}`, 204);
    const motion = new Motion();
    const response = expectResponse(await motion.fetch(mockPath));
    expect(response.status).toEqual(204);
  });

  it("should give a client with only a user ID and API key", async () => {
    fetchMock.get(`${motionBaseUrl}${mockPath}`, 204);
    const motion = new Motion({
      userId: "test-user-id",
      apiKey: "test-api-key",
    });
    const response = expectResponse(await motion.fetch(mockPath));
    expect(response.status).toEqual(204);
  });

  /** NOTE. This is an example in the docs, be sure to keep it in sync */
  it("should customize rate limiters", async () => {
    // 1 request per 5 seconds
    const requestLimiter = new RateLimiterMemory({
      points: 1,
      duration: 5, // seconds
    });

    // 2 overruns per day
    const overrunLimiter = new RateLimiterMemory({
      points: 2,
      duration: 60 * 60 * 24,
    });

    const motion = new Motion({
      requestLimiter,
      overrunLimiter,
      maxQueueSize: 0, // Disable queue
    });

    await motion.fetch("/users/me");
  });

  describe("fetch", () => {
    it("should pass through to the system fetch", async () => {
      const motion = inMemoryTestClient();
      fetchMock.get(`${baseUrl}${mockPath}`, 204);
      const response = expectResponse(await motion.fetch(mockPath));
      expect(response.status).toEqual(204);
    });

    it.prop([fc.domain().map((d) => `https://${d}`)])(
      "should call the configured base URL",
      async (customBaseUrl: string) => {
        const motion = inMemoryTestClient({ baseUrl: customBaseUrl });
        const targetPath = `${customBaseUrl}${mockPath}`;
        fetchMock.get(targetPath, 204);
        await motion.fetch(mockPath);
        expect(fetchMock.callHistory.called(targetPath)).toBe(true);
      },
    );

    it("should default to Motion's base URL", async () => {
      const motion = new Motion({
        userId: "testUserId",
        apiKey: "testApiKey",
        requestLimiter: new RateLimiterMemory(recommendedRateLimits.requests),
        overrunLimiter: new RateLimiterMemory(recommendedRateLimits.overruns),
      });
      const targetPath = `${motionBaseUrl}${mockPath}`;
      fetchMock.get(targetPath, 204);
      await motion.fetch(mockPath);
      expect(fetchMock.callHistory.called(targetPath)).toBe(true);
    });

    it("should return LimiterError if we fail to reach the request limiter", async () => {
      const requestLimiter = new RateLimiterMemory(
        recommendedRateLimits.requests,
      );
      const motion = new Motion({
        baseUrl,
        userId: "testUserId",
        apiKey: "testApiKey",
        requestLimiter,
        overrunLimiter: new RateLimiterMemory(recommendedRateLimits.overruns),
      });
      const e = new Error();
      const consume = jest
        .spyOn(RateLimiterMemory.prototype, "consume")
        .mockRejectedValue(e);
      try {
        expectMotionError(await motion.fetch(mockPath), limiterErrorType);
      } finally {
        consume.mockRestore();
      }
    });

    it("should not call Motion if we fail to reach the request limiter", async () => {
      const requestLimiter = new RateLimiterMemory(
        recommendedRateLimits.requests,
      );
      const motion = new Motion({
        baseUrl,
        userId: "testUserId",
        apiKey: "testApiKey",
        requestLimiter,
        overrunLimiter: new RateLimiterMemory(recommendedRateLimits.overruns),
      });
      const e = new Error();
      const consume = jest
        .spyOn(RateLimiterMemory.prototype, "consume")
        .mockRejectedValue(e);
      try {
        await motion.fetch(mockPath);
        expect(fetchMock.callHistory.called()).toBe(false);
      } finally {
        consume.mockRestore();
      }
    });

    it("should return QueueOverflowError if the queue is full", async () => {
      const requestLimiter = new RateLimiterMemory({
        points: 1,
        duration: 1,
      });
      const motion = new Motion({
        baseUrl,
        userId: "testUserId",
        apiKey: "testApiKey",
        requestLimiter,
        overrunLimiter: new RateLimiterMemory(recommendedRateLimits.overruns),
        maxQueueSize: 1,
      });
      fetchMock.get(`${baseUrl}${mockPath}`, 204);
      await Promise.all([
        motion.fetch(mockPath),
        motion.fetch(mockPath),
        motion.fetch(mockPath),
      ]).then(([, , r3]) => {
        expectMotionError(r3, queueOverflowErrorType);
      });
    });

    it("should close the client on getting limit_exceeded from Motion", async () => {
      const motion = inMemoryTestClient();
      fetchMock.get(`${baseUrl}${mockPath}`, limitExceeded());
      await motion.fetch(mockPath);
      fetchMock.clearHistory();
      const result = await motion.fetch(mockPath);
      expectMotionError(result, closedErrorType);
      expect(fetchMock.callHistory.called()).toBe(false);
    });

    it("should force-consume an overrun token on getting limit_exceeded from motion", async () => {
      const motion = inMemoryTestClient();
      fetchMock.get(`${baseUrl}${mockPath}`, limitExceeded());
      const before =
        (await motion.overrunLimiter.get(motion.overrunLimiterKey))
          ?.consumedPoints ?? 0;
      await motion.fetch(mockPath);
      const after = (await motion.overrunLimiter.get(motion.overrunLimiterKey))
        ?.consumedPoints;
      expect(after).toEqual(before + 1);
    });

    it("Should return LimiterError if we fail to set the overrun limiter", async () => {
      const overrunLimiter = new RateLimiterMemory({
        points: 2,
        duration: 2,
      });
      const motion = new Motion({
        baseUrl,
        userId: "testUserId",
        apiKey: "testApiKey",
        requestLimiter: new RateLimiterMemory(recommendedRateLimits.requests),
        overrunLimiter,
      });
      const e = new Error();
      fetchMock.get(`${baseUrl}${mockPath}`, limitExceeded());
      const penalty = jest
        .spyOn(RateLimiterMemory.prototype, "penalty")
        .mockRejectedValue(e);
      try {
        expectMotionError(await motion.fetch(mockPath), limiterErrorType);
      } finally {
        penalty.mockRestore();
      }
    });

    it("Should still close the client even if we fail to set the overrun limiter (_especially_ then)", async () => {
      const limiter = new RateLimiterMemory({
        points: 2,
        duration: 2,
      });
      const motion = new Motion({
        baseUrl,
        userId: "testUserId",
        apiKey: "testApiKey",
        requestLimiter: new RateLimiterMemory(recommendedRateLimits.requests),
        overrunLimiter: limiter,
      });
      fetchMock.get(`${baseUrl}${mockPath}`, limitExceeded());
      const penalty = jest
        .spyOn(limiter, "penalty")
        .mockRejectedValue(new Error("Some error"));
      try {
        await motion.fetch(mockPath).catch(() => {
          // ignore error
        });
        fetchMock.clearHistory();
        await motion.fetch(mockPath);
        expect(fetchMock.callHistory.called()).toBe(false);
      } finally {
        penalty.mockRestore();
      }
    });
  });

  describe("unsafe_fetch", () => {
    it("should call Motion and return the response", async () => {
      const motion = inMemoryTestClient();
      fetchMock.get(`${baseUrl}${mockPath}`, 204);
      const response = expectResponse(await motion.unsafe_fetch(mockPath));
      expect(response.status).toEqual(204);
    });

    it("should return an error if there is no API key", async () => {
      const oldApiKey = process.env.MOTION_API_KEY;
      delete process.env.MOTION_API_KEY;
      try {
        const motion = new Motion();
        expectMotionError(
          await motion.unsafe_fetch(mockPath),
          argumentErrorType,
        );
      } finally {
        process.env.MOTION_API_KEY = oldApiKey;
      }
    });

    it("should return FetchError if the fetch fails", async () => {
      const motion = inMemoryTestClient();
      fetchMock.get(`${baseUrl}${mockPath}`, {
        throws: new Error("Test error"),
      });
      const response = await motion.unsafe_fetch(mockPath);
      expectMotionError(response, fetchErrorType);
    });

    it("should return a limit exceeded error on getting limit_exceeded from Motion", async () => {
      const motion = inMemoryTestClient();
      fetchMock.get(`${baseUrl}${mockPath}`, limitExceeded());
      const response = await motion.unsafe_fetch(mockPath);
      expectMotionError(response, limitExceededErrorType);
    });
  });

  describe("close", () => {
    it("should cancel queued requests", async () => {
      const motion = inMemoryTestClient({
        requestLimiter: new RateLimiterMemory({ points: 1, duration: 2 }),
      });
      fetchMock.get(`${baseUrl}${mockPath}`, 204);
      jest.useFakeTimers();
      try {
        await motion.fetch(mockPath);
        const waiting = motion.fetch(mockPath);
        motion.close("Test: should cancel queued requests");
        await jest.advanceTimersByTimeAsync(6000);
        const r = await waiting;
        expectMotionError(r, closedErrorType);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  function limitExceeded(): RouteResponse {
    return {
      status: 429,
      body: JSON.stringify(limitExceededError),
      headers: {
        "content-type": "application/json",
      },
    };
  }
});
