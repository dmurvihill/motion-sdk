import { it, fc } from "@fast-check/jest";
import {
  ArgumentError,
  bundleErrors,
  ClosedError,
  isArgumentError,
  isClosedError,
  isLimiterError,
  isMultiError,
  isQueueOverflowError,
  LimiterError,
  type MotionError,
  MultiError,
  QueueOverflowError,
} from "../src/error.js";
import {
  closedErrorType,
  fetchErrorType,
  limitExceededErrorType,
  multiErrorType,
} from "../src/constant.js";
import {
  RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterQueue,
} from "rate-limiter-flexible";
import { Arbitrary } from "fast-check";
import { number, rateLimiter, rateLimiterQueue } from "./util/generators.js";
import { RateLimiterQueueError } from "rate-limiter-flexible/lib/component/index.js";

const limiterErrorParams = fc.record({
  message: fc.oneof(fc.string(), fc.constant(undefined)),
  causeType: fc.constantFrom("string", "Error"),
  attemptedKey: fc.oneof(fc.string(), fc.double()) as Arbitrary<
    string | number | undefined
  >,
});

function motionError(): Arbitrary<MotionError> {
  return fc.oneof(
    limiterError(),
    queueOverflowError(),
    argumentError(),
    // closedError() would need special handling due to mutual recursion
    // multiError() would need special handling due to mutual recursion
    fc.record({
      errorType: fc.oneof(
        ...[
          fc.constant(closedErrorType),
          fc.constant(multiErrorType),
          fc.constant(fetchErrorType),
          fc.constant(limitExceededErrorType),
        ],
      ),
      message: fc.string(),
    }),
  );
}

function argumentError(): Arbitrary<ArgumentError<unknown>> {
  return fc
    .tuple(fc.string(), fc.anything(), fc.string())
    .map(
      ([argumentName, argumentValue, message]: [string, unknown, string]) => {
        return new ArgumentError(argumentName, argumentValue, message);
      },
    );
}

function closedError(): Arbitrary<ClosedError> {
  return fc
    .tuple(fc.string(), fc.option(motionError()))
    .map(([reason, cause]: [string, MotionError | null]) => {
      return cause === null
        ? new ClosedError(reason)
        : new ClosedError(reason, cause);
    });
}

function multiError(): Arbitrary<MultiError<MotionError>> {
  return fc
    .array(motionError())
    .map((errors) => new MultiError<MotionError>(errors));
}

function limiterError(): Arbitrary<LimiterError> {
  return fc
    .tuple(
      rateLimiter(),
      fc.oneof(fc.constant(undefined), fc.string(), fc.integer()),
    )
    .map(
      ([limiter, attemptedKey]: [
        RateLimiterAbstract,
        string | number | undefined,
      ]) => {
        return new LimiterError(limiter, new Error(), attemptedKey);
      },
    );
}

function queueOverflowError(): Arbitrary<QueueOverflowError> {
  return fc
    .tuple(rateLimiterQueue(), fc.oneof(fc.string(), number()))
    .map(
      ([queue, attemptedKey]: [RateLimiterQueue, string | number]) =>
        new QueueOverflowError(
          queue,
          new Error() as RateLimiterQueueError,
          attemptedKey,
        ),
    );
}

describe("bundleErrors", () => {
  it.prop([fc.array(motionError(), { minLength: 1, maxLength: 10 })])(
    "Should wrap in MultiError iff necessary",
    (errors: MotionError[]) => {
      expect(bundleErrors(errors).errorType).toBe(
        errors.length === 1 ? errors[0].errorType : multiErrorType,
      );
    },
  );
});

describe("isArgumentError", () => {
  it.prop([argumentError()])(
    "should accept all ArgumentErrors",
    (e: unknown) => {
      expect(isArgumentError(e)).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      isArgumentError(e) && e.argumentName; // check type narrowing
    },
  );
});

describe("isClosedError", () => {
  it.prop([closedError()])("should accept all ClosedErrors", (e: unknown) => {
    expect(isClosedError(e)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    isClosedError(e) && e.reason.length; // check type narrowing
  });
});

describe("isMultiError", () => {
  it.prop([multiError()])("should accept all MultiErrors", (e: unknown) => {
    expect(isMultiError(e)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    isMultiError(e) && e.errors; // check type narrowing
  });
});

describe("isLimiterError", () => {
  it.prop([limiterError()])("should accept all LimiterErrors", (e: unknown) => {
    expect(isLimiterError(e)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    isLimiterError(e) && e.limiter.points; // check type narrowing
  });
});

describe("isQueueOverflowError", () => {
  it.prop([queueOverflowError()])(
    "should accept all QueueOverflowErrors",
    (e: unknown) => {
      expect(isQueueOverflowError(e)).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      isQueueOverflowError(e) && e.queue; // check type narrowing
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
