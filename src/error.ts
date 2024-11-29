import {
  closedErrorType,
  fetchErrorType,
  argumentErrorType,
  limiterErrorType,
  limitExceededErrorType,
  multiErrorType,
  queueOverflowErrorType,
} from "./constant.js";
import { RateLimiterAbstract, RateLimiterQueue } from "rate-limiter-flexible";
import * as assert from "assert";
import { RateLimiterQueueError } from "rate-limiter-flexible/lib/component/index.js";
import { isObject } from "./lib.js";

/** Base interface for all errors returned by `motion-sdk`
 *
 * @public
 */
export interface MotionError {
  errorType: string;
  message: string;
}

/** {@inheritDoc argumentErrorType}
 *
 * @public
 * */
export class ArgumentError<T> extends Error implements MotionError {
  errorType: typeof argumentErrorType = argumentErrorType;

  constructor(
    readonly argumentName: string,
    argumentValue: T,
    readonly message: string,
  ) {
    super(message);
  }
}

/** {@inheritDoc fetchErrorType}
 *
 * @public
 */
export class FetchError extends Error implements MotionError {
  readonly errorType: typeof fetchErrorType = fetchErrorType;

  constructor(
    /** The error that was thrown by fetch */
    readonly cause: unknown,
    /** The failing {@link https://developer.mozilla.org/en-US/docs/Web/API/Request | Request} */
    readonly request: {
      input: string | URL | globalThis.Request;
      init?: RequestInit;
    },
  ) {
    super(messageFromCause(cause));
  }
}

/** {@inheritDoc closedErrorType}
 *
 * @public
 */
export class ClosedError extends Error implements MotionError {
  readonly errorType: typeof closedErrorType = closedErrorType;

  constructor(
    /** Developer-readable reason for the closure */
    readonly reason: string,
    /** error that caused the closure */
    readonly cause?: MotionError,
  ) {
    super(`Client is already closed. Closure reason: ${reason}`);
  }
}

/** {@inheritDoc limitExceededErrorType}
 *
 * @public
 */
export class LimitExceededError extends Error implements MotionError {
  errorType: typeof limitExceededErrorType = limitExceededErrorType;

  constructor(
    /** {@link https://developer.mozilla.org/en-US/docs/Web/API/Response | Response} that was returned by Motion */
    readonly response: Response,
  ) {
    super(limitExceededMessage);
  }
}

/** {@inheritDoc multiErrorType}
 *
 * @public
 */
export class MultiError<T extends MotionError>
  extends Error
  implements MotionError
{
  readonly errorType: typeof multiErrorType = multiErrorType;

  constructor(
    /** The underlying errors */
    readonly errors: T[],
  ) {
    super(`${errors.length.toString(10)} errors occurred.`);
  }
}

/** {@inheritDoc limiterErrorType}
 *
 * @public
 */
export class LimiterError extends Error implements MotionError {
  errorType: typeof limiterErrorType = limiterErrorType;

  constructor(
    /** The erroring limiter */
    readonly limiter: RateLimiterAbstract,
    /** The error */
    readonly cause: unknown,
    /** The rate limiter key that was attempted */
    readonly attemptedKey?: string | number,
  ) {
    super(`Error from rate limiter: ${messageFromCause(cause)}`);
  }
}

/** {@inheritDoc queueOverflowErrorType }
 *
 * @public
 * */
export class QueueOverflowError extends Error implements MotionError {
  errorType: typeof queueOverflowErrorType = queueOverflowErrorType;

  constructor(
    /** The overflowing queue */
    readonly queue: RateLimiterQueue,
    /** The overflow error from the underlying framework */
    readonly cause: RateLimiterQueueError,
    /** The rate limiter key that was attempted */
    readonly attemptedKey: string | number,
  ) {
    super(cause.message);
  }
}

const limitExceededMessage =
  "We exceeded Motion's rate limit. Continuing to exceed the rate limit will cause them to disable your API access. See also: https://docs.usemotion.com/docs/motion-rest-api/44e37c461ba67-motion-rest-api#rate-limit-information";

/** Collate errors into a single {@link MultiError}
 *
 * @param errors - errors to collate
 *
 * @internal
 */
export function bundleErrors<T extends MotionError>(
  errors: T[],
): T | MultiError<T> {
  assert.strictEqual(errors.length > 0, true);
  return errors.length > 1 ? new MultiError(errors) : errors[0];
}

/** Type assertion for {@link MotionError}
 *
 * @public
 */
export function isMotionError(o: unknown): o is MotionError {
  return isObject(o) && "errorType" in o;
}

/** Type assertion for {@link FetchError}
 *
 * @public
 */
export function isFetchError(o: unknown): o is FetchError {
  return isMotionError(o) && o.errorType === fetchErrorType;
}

/** Type assertion for {@link LimitExceededError}
 *
 * @public
 */
export function isLimitExceededError(o: unknown): o is LimitExceededError {
  return isMotionError(o) && o.errorType === limitExceededErrorType;
}

/** Type assertion for {@link MultiError}
 *
 * @public
 */
export function isMultiError(o: unknown): o is MultiError<MotionError> {
  return isMotionError(o) && o.errorType === multiErrorType;
}

/** Summarize an error based on its cause
 *
 * @param cause
 *
 * @internal
 */
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

/** Possible single errors returned by {@link Motion.unsafe_fetch}
 *
 * @internal
 */
export type UnsafeFetchIndividualError =
  | ArgumentError<null>
  | LimitExceededError
  | FetchError;

/** Possible errors returned by {@link Motion.unsafe_fetch}
 *
 * @public
 */
export type UnsafeFetchError =
  | UnsafeFetchIndividualError
  | MultiError<UnsafeFetchIndividualError>;

/** Possible single errors returned by {@link Motion.fetch}
 *
 * @internal
 */
export type FetchIndividualError =
  | UnsafeFetchIndividualError
  | ClosedError
  | LimiterError
  | QueueOverflowError;

/** Possible errors returned by {@link Motion.fetch}
 *
 * @public
 */
export type MotionFetchError =
  | FetchIndividualError
  | MultiError<FetchIndividualError>;
