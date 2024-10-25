import { it, fc } from "@fast-check/jest";
import { bundleErrors, LimiterError, MotionError } from "../src/error.js";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { Arbitrary } from "fast-check";
import { multiErrorType } from "../src/constant.js";

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
