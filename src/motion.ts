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
  InvalidOptionError,
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

  constructor(opts?: MotionOptions) {
    this._closedReason = null;
    this.userId = opts?.userId ?? process.env.MOTION_USER_ID ?? null;
    this.apiKey = opts?.apiKey ?? process.env.MOTION_API_KEY ?? null;
    if (this.userId === null) {
      const e = new InvalidOptionError(
        "userId",
        opts?.userId,
        `No user ID set; expected 'userId' option in constructor, or MOTION_USER_ID environment variable`,
      );
      this.close(e.message, e);
    } else if (this.apiKey === null) {
      const e = new InvalidOptionError(
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

  /** Low-level interface to Motion API
   *
   * This function does not respect rate limiting or anything else about
   * the client state. It can be called and will happily reach out to
   * the Motion API even if close() has been called.
   *
   * Normally, this function should only be called from fetch(). Use at your
   * own peril.
   *
   * @param input
   * @param init
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

  private setHeaders(
    headers?: HeadersInit,
  ): HeadersInit | InvalidOptionError<null> {
    if (this.apiKey === null) {
      return new InvalidOptionError("apiKey", this.apiKey, "No API key set");
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

export interface MotionOptions {
  baseUrl?: string;
  userId?: string;
  apiKey?: string;
  requestLimiter?: RateLimiterAbstract;
  overrunLimiter?: RateLimiterAbstract;
  maxQueueSize?: number;
}

export interface MotionRateLimits {
  requests: Required<Pick<IRateLimiterOptions, "points" | "duration">>;
  overruns: Required<Pick<IRateLimiterOptions, "points" | "duration">>;
}

export interface ClosedReason {
  reason: string;
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
