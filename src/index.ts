import {
  RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterQueue,
} from "rate-limiter-flexible";
import {
  bundleErrors,
  ClosedReason,
  isFetchError,
  isLimiterErrAboutAQueueOverflow,
  LimiterError,
  LimitExceededError,
  MotionFetchError,
  FetchError,
  QueueOverflowError,
  UnsafeFetchError,
  UnsafeFetchIndividualError,
  ClosedError,
  InvalidOptionError,
  MotionError,
  isMotionError,
} from "./error.js";
import { motionBaseUrl } from "./constant.js";

const removeNullPathSegments = /([^:]\/)\/+/g;

export class Motion {
  readonly userId: string | null;
  private readonly apiKey: string | null;
  readonly baseUrl: string;
  readonly requestQueue: RateLimiterQueue;
  readonly requestLimiter: RateLimiterAbstract;
  readonly overrunLimiter: RateLimiterAbstract;
  readonly requestLimiterKey: string;
  readonly overrunLimiterKey: string;
  private closedReason: ClosedReason | null;

  constructor(opts?: MotionOptions) {
    this.closedReason = null;
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
    if (this.closedReason !== null) {
      return Promise.resolve(
        new ClosedError(this.closedReason.reason, this.closedReason.cause),
      );
    }
    try {
      await this.requestQueue.removeTokens(1, this.requestLimiterKey);
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
    return this.unsafe_fetch(input, init);
  }

  isOpen(): boolean {
    return this.closedReason === null;
  }

  close(reason: string, cause?: MotionError): undefined | ClosedError {
    if (this.closedReason !== null) {
      return new ClosedError(this.closedReason.reason, this.closedReason.cause);
    } else {
      this.closedReason = {
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
      return this.handleLimitExceeded(response);
    } else {
      return response;
    }
  }

  private async handleLimitExceeded(
    response: Response,
  ): Promise<UnsafeFetchError> {
    const errors: UnsafeFetchIndividualError[] = [];
    const e = new LimitExceededError(response);
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
}

export interface MotionOptions {
  baseUrl?: string;
  userId: string;
  apiKey: string;
  requestLimiter: RateLimiterAbstract;
  overrunLimiter: RateLimiterAbstract;
  maxQueueSize?: number;
}

const defaultQueueSize = 20;

/** Official rate limits used by Motion
 *
 * NOTE: For additional safety, consider using recommendedRateLimits instead.
 * */
export const motionRateLimits = {
  // Exceeding 12 requests in a minute results in a 1 hr. lockout
  requests: {
    points: 12,
    duration: 60,
  },

  // Exceeding 12/min three times in a day results in a permanent lockout.
  // Don't make Harry sad!
  overruns: {
    points: 3,
    duration: 60 * 60 * 24,
  },
};

export const recommendedRateLimits = {
  requests: {
    points: motionRateLimits.requests.points - 1,
    duration: motionRateLimits.requests.duration,
  },

  overruns: {
    points: 1,
    duration: motionRateLimits.overruns.duration,
  },
};
