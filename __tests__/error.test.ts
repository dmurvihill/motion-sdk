import { it, fc } from "@fast-check/jest";
import {
  bundleErrors,
  ClosedError,
  isClosedError,
  isLimiterError,
  isMotionError,
  isQueueOverflowError,
  LimiterError,
  type MotionError,
  QueueOverflowError,
} from "../src/error.js";
import { multiErrorType } from "../src/constant.js";
import { RateLimiterMemory, RateLimiterQueue } from "rate-limiter-flexible";
import { Arbitrary } from "fast-check";
import { RateLimiterParams, rateLimiterParams } from "./util/generators.js";
import { RateLimiterQueueError } from "rate-limiter-flexible/lib/component/index.js";

const limiterErrorParams = fc.record({
  message: fc.oneof(fc.string(), fc.constant(undefined)),
  causeType: fc.constantFrom("string", "Error"),
  attemptedKey: fc.oneof(fc.string(), fc.double()) as Arbitrary<
    string | number | undefined
  >,
});

const motionError: Arbitrary<MotionError> = fc.record({
  errorType: fc.string(),
  message: fc.string(),
});

describe("Error type assertions", () => {
  it.prop([motionError])(
    "isMotionError should match all MotionErrors",
    (error) => {
      expect(isMotionError(error)).toBe(true);
    },
  );

  it.prop([
    rateLimiterParams(),
    fc.option(fc.oneof(fc.string(), fc.integer()), { nil: undefined }),
  ])(
    "isLimiterError should match all LimiterErrors",
    (limiterParams: RateLimiterParams, attemptedKey) => {
      const error = new LimiterError(
        new RateLimiterMemory(limiterParams),
        new Error(),
        attemptedKey,
      );
      expect(isLimiterError(error)).toBe(true);
    },
  );

  it.prop([rateLimiterParams(), fc.oneof(fc.string(), fc.integer())])(
    "isQueueOverflowError",
    (params: RateLimiterParams, attemptedKey) => {
      const error = new QueueOverflowError(
        new RateLimiterQueue(new RateLimiterMemory(params), {
          maxQueueSize: params.maxQueueLength,
        }),
        new Error() as unknown as RateLimiterQueueError,
        attemptedKey,
      );
      expect(isQueueOverflowError(error)).toBe(true);
    },
  );

  it.prop([fc.string(), fc.option(motionError, { nil: undefined })])(
    "isClosedError should match all ClosedErrors",
    (reason: string, cause) => {
      expect(isClosedError(new ClosedError(reason, cause))).toBe(true);
    },
  );
});

describe("bundleErrors", () => {
  it.prop([fc.array(motionError, { minLength: 1, maxLength: 10 })])(
    "Should wrap in MultiError iff necessary",
    (errors: MotionError[]) => {
      expect(bundleErrors(errors).errorType).toBe(
        errors.length === 1 ? errors[0].errorType : multiErrorType,
      );
    },
  );
});

describe("messageFromCause", () => {
  it.prop([limiterErrorParams])("should preserve the original message", (p) => {
    const { message, causeType, attemptedKey } = p;
    const e = new LimiterError(
      new RateLimiterMemory({}),
      causeType === "string" ? message : new Error(message),
      attemptedKey,
    );
    expect(e.message).toContain(message ?? "(no message)");
  });
});
