import { Motion, recommendedRateLimits } from "../src/index.js";
import fetchMock, { RouteResponse } from "fetch-mock";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { jest } from "@jest/globals";
import { isMotionError, isMultiError, MotionError } from "../src/error.js";
import {
  closedErrorType,
  limiterErrorType,
  limitExceededErrorType,
  fetchErrorType,
  queueOverflowErrorType,
} from "../src/constant.js";

const limitExceededError = {
  message: "Rate limit exceeded. Consult docs for rate limit information",
};

const baseUrl = "https://stoplight.io/mocks/motion/motion-rest-api/33447";
const mockPath = "/some_path";

describe("Motion", () => {
  describe("Get My User", () => {
    it("should return the user", async () => {
      const motion = inMemoryTestClient();
      const response = expectResponse(await motion.fetch("users/me"));
      expect(await response.json()).toEqual(
        expect.objectContaining({
          email: expect.stringMatching(/.*/), // eslint-disable-line @typescript-eslint/no-unsafe-assignment
          id: expect.stringMatching(/.*/), // eslint-disable-line @typescript-eslint/no-unsafe-assignment
          name: expect.stringMatching(/.*/), // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        }),
      );
    });
  });
});

describe("Motion rate limit enforcement", () => {
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

  describe("fetch", () => {
    it("should pass through to Motion", async () => {
      const motion = inMemoryTestClient();
      fetchMock.get(`${baseUrl}/${mockPath}`, 204);
      const response = expectResponse(await motion.fetch(mockPath));
      expect(response.status).toEqual(204);
    });

    it("should return LimiterError if we fail to reach the request limiter", async () => {
      const requestLimiter = new RateLimiterMemory(
        recommendedRateLimits.requests,
      );
      const motion = new Motion({
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
        userId: "testUserId",
        apiKey: "testApiKey",
        requestLimiter,
        overrunLimiter: new RateLimiterMemory(recommendedRateLimits.overruns),
        maxQueueSize: 1,
      });
      fetchMock.get(`${baseUrl}/${mockPath}`, 204);
      await Promise.all([
        motion.fetch(mockPath),
        motion.fetch(mockPath),
        motion.fetch(mockPath),
      ]).then(([, , r3]) => {
        expectMotionError(r3, queueOverflowErrorType);
      });
    });
  });

  describe("unsafe_fetch", () => {
    it("should call Motion and return the response", async () => {
      const motion = inMemoryTestClient();
      fetchMock.get(`${baseUrl}/${mockPath}`, 204);
      const response = expectResponse(await motion.unsafe_fetch(mockPath));
      expect(response.status).toEqual(204);
    });

    it("should return FetchError if the fetch fails", async () => {
      const motion = inMemoryTestClient();
      fetchMock.get(mockPath, { throws: new Error("Test error") });
      const response = await motion.unsafe_fetch(mockPath);
      expectMotionError(response, fetchErrorType);
    });

    it("should return a limit exceeded error on getting limit_exceeded from Motion", async () => {
      const motion = inMemoryTestClient();
      fetchMock.get(`${baseUrl}/${mockPath}`, limitExceeded());
      const response = await motion.unsafe_fetch(mockPath);
      expectMotionError(response, limitExceededErrorType);
    });

    it("should close the client on getting limit_exceeded from Motion", async () => {
      const motion = inMemoryTestClient();
      fetchMock.get(`${baseUrl}/${mockPath}`, limitExceeded());
      await motion.unsafe_fetch(mockPath);
      fetchMock.clearHistory();
      const result = await motion.fetch(mockPath);
      expect(result).toMatchObject({ errorType: closedErrorType });
      expect(fetchMock.callHistory.called()).toBe(false);
    });

    it("should force-consume an overrun token on getting limit_exceeded from motion", async () => {
      const motion = inMemoryTestClient();
      fetchMock.get(`${baseUrl}/${mockPath}`, limitExceeded());
      const before =
        (await motion.overrunLimiter.get(motion.overrunLimiterKey))
          ?.consumedPoints ?? 0;
      await motion.unsafe_fetch(mockPath);
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
        userId: "testUserId",
        apiKey: "testApiKey",
        requestLimiter: new RateLimiterMemory(recommendedRateLimits.requests),
        overrunLimiter,
      });
      const e = new Error();
      fetchMock.get(`${baseUrl}/${mockPath}`, limitExceeded());
      const penalty = jest
        .spyOn(RateLimiterMemory.prototype, "penalty")
        .mockRejectedValue(e);
      try {
        expectMotionError(
          await motion.unsafe_fetch(mockPath),
          limiterErrorType,
        );
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
        userId: "testUserId",
        apiKey: "testApiKey",
        requestLimiter: new RateLimiterMemory(recommendedRateLimits.requests),
        overrunLimiter: limiter,
      });
      fetchMock.get(`${baseUrl}/${mockPath}`, limitExceeded());
      const penalty = jest
        .spyOn(limiter, "penalty")
        .mockRejectedValue(new Error("Some error"));
      try {
        await motion.unsafe_fetch(mockPath).catch(() => {
          // ignore error
        });
        fetchMock.clearHistory();
        await motion.fetch(mockPath);
        expect(fetchMock.callHistory.called()).toBe(false);
      } finally {
        penalty.mockRestore();
      }
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
});

function expectResponse(r: Response | MotionError): Response {
  expect(r).not.toMatchObject({
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
    errorType: expect.anything(),
  });
  if ("errorType" in r) {
    throw new Error("Shouldn't have got here");
  } else {
    return r;
  }
}

function expectMotionError(o: object, errorType: string) {
  if (isMotionError(o)) {
    if (isMultiError(o)) {
      expect(o.errors).toContainEqual(expect.objectContaining({ errorType }));
    } else {
      expect(o.errorType).toEqual(errorType);
    }
  } else {
    expect("errorType" in o).toBe(true);
  }
}

function inMemoryTestClient() {
  return new Motion({
    userId: "testUserId",
    apiKey: "testApiKey",
    requestLimiter: new RateLimiterMemory(recommendedRateLimits.requests),
    overrunLimiter: new RateLimiterMemory(recommendedRateLimits.overruns),
  });
}
