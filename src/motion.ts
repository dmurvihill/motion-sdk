import {
  IRateLimiterOptions,
  RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterQueue,
} from "rate-limiter-flexible";
import {
  bundleErrors,
  ClosedError,
  FetchError,
  FetchIndividualError,
  ArgumentError,
  isFetchError,
  isLimitExceededError,
  isMotionError,
  LimiterError,
  LimitExceededError,
  MotionError,
  MotionFetchError,
  QueueOverflowError,
  UnsafeFetchError,
} from "./error.js";
import {
  defaultQueueSize,
  motionBaseUrl,
  recommendedRateLimits,
} from "./constant.js";
import { RateLimiterQueueError } from "rate-limiter-flexible/lib/component/index.js";
import { isObject } from "./lib.js";

const removeNullPathSegments = /([^:]\/)\/+/g;
const queueOverflowRegex = /number of requests reached it'?s maximum/;

/** Motion API client
 *
 * @remarks
 *
 * Simple wrapper around the usemotion.com API. Just provide a user ID
 * and API key, and then start making requests.
 *
 * Warning: Motion {@link https://docs.usemotion.com/docs/motion-rest-api/44e37c461ba67-motion-rest-api#rate-limit-information | enforces}
 * its rate limit strictly. Excessive overruns of the rate limit can
 * result in losing your API privileges and having to get them back
 * through customer support.
 *
 * This client will not exceed the rate limit so long as only one
 * instance makes requests to the Motion API for any one user and no
 * calls are made directly to any of the `unsafe_` methods. If you
 * require more advanced usage, you can pass a custom rate limiter.
 *
 * @public
 */
export class Motion {
  readonly userId: string | null;
  private readonly apiKey: string | null;
  readonly baseUrl: string;
  readonly requestQueue: RateLimiterQueue;
  readonly requestLimiter: RateLimiterAbstract;
  readonly overrunLimiter: RateLimiterAbstract;
  readonly requestLimiterKey: string;
  readonly overrunLimiterKey: string;
  private _closedReason: ClosedReason | null;

  /** Create a Motion API client
   *
   * @remarks
   * Initializes a Motion API client with the provided user ID and API key.
   * Consult the {@link https://help.usemotion.com/integrations/integrations-101/api-docs | Motion API docs} for how to get an API key.
   *
   * If there may be multiple `Motion` clients sharing the same user,
   * you must pass a custom request rate limiter and a custom overrun
   * rate limiter that share the same backing store as the other
   * `Motion` clients.
   *
   * You may adjust the maximum number of queued requests; the
   * default is {@link defaultQueueSize}.
   *
   * `motion-sdk` does not throw. If the constructor is called with
   * invalid arguments or if another error occurs, the client will be
   * closed immediately. The error will be set in
   * {@link Motion.closedReason | closedReason}.
   *
   * @example
   * Basic usage:
   * ```typescript
   * const motion = new Motion({
   *   userId: 'my-user-id',
   *   apiKey: 'my-api-key',
   * });
   * ```
   *
   * @example
   * Or, you can set the environment variables `MOTION_USER_ID` and
   * `MOTION_API_KEY`. Then:
   * ```typescript
   * const motion = new Motion();
   * ```
   *
   * @example
   * To set custom rate limiters:
   *
   * ```typescript
   * // 1 request per 5 seconds
   * const requestLimiter = new RateLimiterMemory({
   *   points: 1,
   *   duration: 5, // seconds
   * });

   * // 2 overruns per day
   * const overrunLimiter = new RateLimiterMemory({
   *   points: 2,
   *   duration: 60 * 60 * 24,
   * });

   * const motion = new Motion({
   *   requestLimiter,
   *   overrunLimiter,
   *   maxQueueSize: 0, // Disable queue
   * });

   * await motion.fetch("/users/me");
   * ```
   *
   * The requestLimiter and overrunLimiter must be instances of the
   * {@link https://github.com/animir/node-rate-limiter-flexible/blob/master/lib/RateLimiterAbstract.js | RateLimiterAbstract}
   * class from {@link https://www.npmjs.com/package/rate-limiter-flexible | rate-limiter-flexible}.
   *
   * As of this writing, `rate-limiter-flexible` provides rate limiters
   * backed by Redis, Prisma, DynamoDB, process Memory, Cluster or PM2,
   * Memcached, MongoDB, MySQL, and PostgreSQL. Refer to their
   * documentation for more detailed help.
   *
   * The default limiter is
   * {@link https://github.com/animir/node-rate-limiter-flexible/blob/master/lib/RateLimiterMemory.js | RateLimiterMemory}
   * with the limits from {@link recommendedRateLimits}. The maximum
   * queue size is given by {@link defaultQueueSize}.
   *
   * @param opts - Object with client parameters
   *
   * @public
   */
  constructor(opts?: MotionOptions) {
    this._closedReason = null;
    this.userId = opts?.userId ?? process.env.MOTION_USER_ID ?? null;
    this.apiKey = opts?.apiKey ?? process.env.MOTION_API_KEY ?? null;
    if (this.userId === null) {
      const e = new ArgumentError(
        "userId",
        opts?.userId,
        `No user ID set; expected 'userId' option in constructor, or MOTION_USER_ID environment variable`,
      );
      this.close(e.message, e);
    } else if (this.apiKey === null) {
      const e = new ArgumentError(
        "apiKey",
        opts?.apiKey,
        `No API key set; expected 'apiKey' option in constructor, or MOTION_API_KEY environment variable`,
      );
      this.close(e.message, e);
    }
    this.requestLimiterKey = `user_${this.userId ?? "null"}:requests`;
    this.overrunLimiterKey = `user_${this.userId ?? "null"}:overruns`;
    this.baseUrl = opts?.baseUrl ?? motionBaseUrl;
    this.requestLimiter =
      opts?.requestLimiter ??
      new RateLimiterMemory(recommendedRateLimits.requests);
    this.overrunLimiter =
      opts?.overrunLimiter ??
      new RateLimiterMemory(recommendedRateLimits.overruns);
    this.requestQueue = new RateLimiterQueue(this.requestLimiter, {
      maxQueueSize: opts?.maxQueueSize ?? defaultQueueSize,
    });
  }

  /** Safe entry point to the HTTP layer
   *
   * @remarks
   * This function makes an HTTP request to the Motion API. The request
   * and return values are the same as the platform
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API | fetch()},
   * except some logic is added for authentication and session management.
   * If a string is passed as the request URL, the API's base URL will
   * be prepended.
   *
   * This method enforces a client-side rate limit so as not to exceed
   * Motion's API rate limits. If there have been too many recent
   * requests, the request will be queued up to the client's maximum
   * queue size. An error will be returned if the queue is overflowing
   * or if there is an issue with the rate limit.
   *
   * In the event the request limiter is misconfigured and Motion returns
   * a 429 Limit Exceeded response, `fetch` assumes the client has
   * entered an unsafe state. The client will close immediately and make
   * no further requests. The overrun will be recorded with the overrun
   * limiter.
   *
   * @example
   * A basic example:
   * ```typescript
   * const response = await motion.fetch("/users/me");
   * if (!isMotionError(response) && response.ok) {
   *   const json = await response.json();
   *   console.log(JSON.stringify(json));
   *   // {"id":"elp69uRwOplFSiM3llAGhixqmPTP","name":"Bill Lumbergh","email":"blumbergh@initech.com"}
   * }
   * ```
   *
   * @param input - URL or Request object
   * @param init - Request parameters
   * @returns {@link https://developer.mozilla.org/en-US/docs/Web/API/Response | Response} or a {@link MotionFetchError}
   */
  async fetch(
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ): Promise<Response | MotionFetchError> {
    if (this._closedReason !== null) {
      return Promise.resolve(
        new ClosedError(this._closedReason.reason, this._closedReason.cause),
      );
    }
    const limiterError = await this.waitForTurn();
    if (typeof limiterError !== "number") {
      return limiterError;
    }
    const newClosedReason = this._closedReason as ClosedReason | null;
    if (newClosedReason !== null) {
      return Promise.resolve(
        new ClosedError(newClosedReason.reason, newClosedReason.cause),
      );
    }
    const response = await this.unsafe_fetch(input, init);
    if (isLimitExceededError(response)) {
      return this.handleLimitExceeded(response);
    } else {
      return response;
    }
  }

  isOpen(): boolean {
    return this._closedReason === null;
  }

  get closedReason(): ClosedReason | null {
    return this._closedReason;
  }

  close(reason: string, cause?: MotionError): undefined | ClosedError {
    if (this._closedReason !== null) {
      return new ClosedError(
        this._closedReason.reason,
        this._closedReason.cause,
      );
    } else {
      this._closedReason = {
        reason,
        cause,
      };
    }
  }

  /** Low-level interface to the Motion API
   *
   * @remarks
   * This function makes a call to the Motion API. The request and
   * return values are the same as the platform
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API | fetch()},
   * except some logic is added for authentication and session management.
   * If a string is passed as the request URL, the API's base URL will
   * be prepended.
   *
   * `unsafe_fetch` does not respect rate limiting or anything else about
   * the client's state. It can be called and will happily make requests
   * to the Motion API even if the limit is already exceeded and even if
   * close() has been called. It will _not_ update the internal rate
   * limiter.
   *
   * Normally this function should be called only from
   * {@link Motion.fetch} but is exposed to accommodate performance
   * optimizations by advanced users. Use at your own peril.
   *
   * @param input - URL or Request object
   * @param init - Request parameters
   *
   * @returns {@link https://developer.mozilla.org/en-US/docs/Web/API/Response | Response} or an {@link UnsafeFetchError}
   */
  async unsafe_fetch(
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ): Promise<Response | UnsafeFetchError> {
    if (typeof input === "string") {
      input = `${this.baseUrl}/${input}`.replace(removeNullPathSegments, "$1");
    }
    if (init === undefined) {
      init = {};
    }
    const newHeaders = this.setHeaders(init.headers);
    if (isMotionError(newHeaders)) {
      return newHeaders;
    }
    init.headers = newHeaders;
    let response: Response | FetchError;
    try {
      response = await fetch(input, init);
    } catch (e: unknown) {
      response = new FetchError(e, { input, init });
    }
    if (!isFetchError(response) && response.status === 429) {
      return new LimitExceededError(response);
    } else {
      return response;
    }
  }

  private async handleLimitExceeded(
    e: LimitExceededError,
  ): Promise<MotionFetchError> {
    const errors: FetchIndividualError[] = [];
    this.close(e.errorType, e);
    errors.push(e);
    try {
      await this.overrunLimiter.penalty(this.overrunLimiterKey, 1);
    } catch (e) {
      errors.push(
        new LimiterError(this.overrunLimiter, e, this.overrunLimiterKey),
      );
    }
    return bundleErrors(errors);
  }

  private setHeaders(headers?: HeadersInit): HeadersInit | ArgumentError<null> {
    if (this.apiKey === null) {
      return new ArgumentError("apiKey", this.apiKey, "No API key set");
    }
    const headersToSet = {
      "X-API-Key": this.apiKey,
      Accept: "application/json",
    };
    if (headers === undefined) {
      headers = {};
    }
    if ("set" in headers) {
      Object.entries(headersToSet).forEach(([k, v]) => {
        (headers as Headers).set(k, v);
      });
    } else if ("length" in headers) {
      Object.entries(headersToSet).forEach(([k, v]) =>
        (headers as [string, string][]).push([k, v]),
      );
    } else {
      Object.assign(headers, headersToSet);
    }
    return headers;
  }

  private async waitForTurn(): Promise<
    number | QueueOverflowError | LimiterError
  > {
    try {
      return await this.requestQueue.removeTokens(1, this.requestLimiterKey);
    } catch (e) {
      if (isLimiterErrAboutAQueueOverflow(e)) {
        return new QueueOverflowError(
          this.requestQueue,
          e,
          this.requestLimiterKey,
        );
      } else {
        return new LimiterError(this.requestLimiter, e, this.requestLimiterKey);
      }
    }
  }
}

/** Arguments to the {@link Motion} constructor
 * @public */
export interface MotionOptions {
  baseUrl?: string;
  userId?: string;
  apiKey?: string;
  requestLimiter?: RateLimiterAbstract;
  overrunLimiter?: RateLimiterAbstract;
  maxQueueSize?: number;
}

/** Rate limit information about the Motion API
 *
 *  Motion has two rate limits:
 *
 *  - If you exceed 12 requests in a minute, Motion will return 429
 *    Limit Exceeded and disable your API access for an hour.
 *    `motion-sdk` calls that an 'overrun'.
 *  - If you have three overruns in a day, Motion will disable your
 *    API access until you contact support and ask them to restore it.
 *
 *  `motion-sdk` is an _unofficial_ client and its authors are not
 *  affiliated with Motion. Always consult the
 *  {@link https://docs.usemotion.com/docs/motion-rest-api/44e37c461ba67-motion-rest-api#rate-limit-information | official API reference }
 *  for up-to-date rate limit information.
 *
 *  @public
 * */
export interface MotionRateLimits {
  requests: Required<Pick<IRateLimiterOptions, "points" | "duration">>;
  overruns: Required<Pick<IRateLimiterOptions, "points" | "duration">>;
}

/** End-of-life information on a Motion client
 *
 * @public
 */
export interface ClosedReason {
  /** Brief, developer-readable explanation for the closure */
  reason: string;

  /** Error that caused the client to closed, if any */
  cause?: MotionError;
}

function isLimiterErrAboutAQueueOverflow(
  o: unknown,
): o is RateLimiterQueueError {
  return (
    isObject(o) &&
    "message" in o &&
    typeof o.message === "string" &&
    queueOverflowRegex.test(o.message.toLowerCase())
  );
}

export default Motion;
