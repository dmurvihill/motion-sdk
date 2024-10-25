import {
  closedErrorType,
  limiterErrorType,
  limitExceededErrorType,
  multiErrorType,
  fetchErrorType,
  queueOverflowErrorType,
} from "./constant.js";
import { RateLimiterAbstract, RateLimiterQueue } from "rate-limiter-flexible";
import * as assert from "assert";
import { RateLimiterQueueError } from "rate-limiter-flexible/lib/component/index.js";

export interface MotionError {
  errorType: string;
  message: string;
}

export class FetchError extends Error implements MotionError {
  readonly errorType: typeof fetchErrorType = fetchErrorType;

  constructor(
    readonly cause: unknown,
    readonly request: {
      input: string | URL | globalThis.Request;
      init?: RequestInit;
    },
  ) {
    super(messageFromCause(cause));
  }
}

export interface ClosedError extends MotionError {
  errorType: typeof closedErrorType;
  closedReason: typeof limitExceededErrorType;
  message: string;
  cause?: LimitExceededError;
}

export class LimitExceededError extends Error implements MotionError {
  errorType: typeof limitExceededErrorType = limitExceededErrorType;

  constructor(readonly response: Response) {
    super(limitExceededMessage);
  }
}

export class MultiError<T extends MotionError>
  extends Error
  implements MotionError
{
  readonly errorType: typeof multiErrorType = multiErrorType;

  constructor(readonly errors: T[]) {
    super(`${errors.length.toString(10)} errors occurred.`);
  }
}

export class LimiterError extends Error implements MotionError {
  errorType: typeof limiterErrorType = limiterErrorType;

  constructor(
    readonly limiter: RateLimiterAbstract,
    readonly cause: unknown,
    readonly attemptedKey?: string | number,
  ) {
    super(`Error from rate limiter: ${messageFromCause(cause)}`);
  }
}

export class QueueOverflowError extends Error implements MotionError {
  errorType: typeof queueOverflowErrorType = queueOverflowErrorType;

  constructor(
    readonly queue: RateLimiterQueue,
    readonly cause: RateLimiterQueueError,
    readonly attemptedKey: string | number,
  ) {
    super(cause.message);
  }
}

export interface ClosedReason {
  reason: typeof limitExceededErrorType;
  cause: LimitExceededError;
}

const limitExceededMessage =
  "We exceeded Motion's rate limit. Continuing to exceed the rate limit will cause them to disable your API access. This client will close. See also: https://docs.usemotion.com/docs/motion-rest-api/44e37c461ba67-motion-rest-api#rate-limit-information";

export function bundleErrors<T extends MotionError>(
  errors: T[],
): T | MultiError<T> {
  assert.strictEqual(errors.length > 0, true);
  return errors.length > 1 ? new MultiError(errors) : errors[0];
}

export function isMotionError(o: object): o is MotionError {
  return "errorType" in o;
}

export function isFetchError(o: object): o is FetchError {
  return isMotionError(o) && o.errorType === fetchErrorType;
}

export function isMultiError(o: object): o is MultiError<MotionError> {
  return isMotionError(o) && o.errorType === multiErrorType;
}

export function isRateLimiterQueueError(o: object): o is RateLimiterQueueError {
  return "message" in o && typeof o.message === "string";
}

function messageFromCause(cause: unknown) {
  let message: string | undefined;
  if (typeof cause === "string") {
    message = cause;
  } else if (typeof cause === "object" && cause !== null) {
    message =
      "message" in cause &&
      typeof cause.message === "string" &&
      cause.message.length > 0
        ? cause.message
        : "(no message)";
  }
  return message ?? "(no message)";
}

export type UnsafeFetchIndividualError =
  | LimitExceededError
  | LimiterError
  | FetchError;
export type UnsafeFetchError =
  | UnsafeFetchIndividualError
  | MultiError<UnsafeFetchIndividualError>;
export type FetchIndividualError =
  | UnsafeFetchIndividualError
  | ClosedError
  | QueueOverflowError;
export type MotionFetchError =
  | FetchIndividualError
  | MultiError<FetchIndividualError>;
