import { RateLimiterAbstract, RateLimiterQueue } from "rate-limiter-flexible";
import { closedErrorType, limitExceededErrorType } from "./constant.js";
import {
  bundleErrors,
  ClosedReason,
  isFetchError,
  isRateLimiterQueueError,
  LimiterError,
  LimitExceededError,
  MotionFetchError,
  FetchError,
  QueueOverflowError,
  UnsafeFetchError,
  UnsafeFetchIndividualError
} from "./error.js";

const motionMockApi = "https://stoplight.io/mocks/motion/motion-rest-api/33447";

export class Motion {
  readonly userId: string;
  private readonly apiKey: string;
  readonly requestQueue: RateLimiterQueue;
  readonly requestLimiter: RateLimiterAbstract;
  readonly overrunLimiter: RateLimiterAbstract;
  readonly requestLimiterKey: string;
  readonly overrunLimiterKey: string;
  private closedReason: ClosedReason | null;

  constructor(opts: MotionOptions) {
    this.closedReason = null;
    this.userId = opts.userId;
    this.apiKey = opts.apiKey;
    this.requestLimiter = opts.requestLimiter;
    this.overrunLimiter = opts.overrunLimiter;
    this.requestLimiterKey = `user_${this.userId}:requests`;
    this.overrunLimiterKey = `user_${this.userId}:overruns`;
    this.requestQueue = new RateLimiterQueue(this.requestLimiter, {
      maxQueueSize: opts.maxQueueSize ?? defaultQueueSize
    });
  }

  /** Low-level interface to Motion API
   *
   * This function does not respect rate limiting or anything else about
   * the client state; normally it should only be called from fetch().
   * Use at your own peril.
   *
   * @param input
   * @param init
   */
  async unsafe_fetch(
    input: string | URL | globalThis.Request,
    init?: RequestInit
  ): Promise<Response | UnsafeFetchError> {
    if (typeof input === "string") {
      input = `${motionMockApi}/${input}`;
    }
    if (init === undefined) {
      init = {};
    }
    init.headers = this.setHeaders(init.headers);
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

  async fetch(
    input: string | URL | globalThis.Request,
    init?: RequestInit
  ): Promise<Response | MotionFetchError> {
    try {
      await this.requestQueue.removeTokens(1, this.requestLimiterKey);
    } catch (e) {
      if (
        typeof e === "object" &&
        e !== null &&
        isRateLimiterQueueError(e) &&
        queueOverflowRegex.test(e.message.toLowerCase())
      ) {
        return new QueueOverflowError(
          this.requestQueue,
          e,
          this.requestLimiterKey
        );
      } else {
        return new LimiterError(this.requestLimiter, e, this.requestLimiterKey);
      }
    }
    return this.closedReason !== null
      ? Promise.resolve({
        errorType: closedErrorType,
        closedReason: this.closedReason.reason,
        message: `This client is closed. Reason: ${this.closedReason.reason}`,
        cause: this.closedReason.cause
      })
      : this.unsafe_fetch(input, init);
  }

  private async handleLimitExceeded(
    response: Response
  ): Promise<UnsafeFetchError> {
    const errors: UnsafeFetchIndividualError[] = [];
    const e = new LimitExceededError(response);
    this.close(e);
    errors.push(e);
    try {
      await this.overrunLimiter.penalty(this.overrunLimiterKey, 1);
    } catch (e) {
      errors.push(
        new LimiterError(this.overrunLimiter, e, this.overrunLimiterKey)
      );
    }
    return bundleErrors(errors);
  }

  private close(cause: LimitExceededError) {
    this.closedReason = {
      reason: limitExceededErrorType,
      cause
    };
  }

  private setHeaders(headers?: HeadersInit): HeadersInit {
    const headersToSet = {
      "X-API-Key": this.apiKey,
      Accept: "application/json"
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
        (headers as [string, string][]).push([k, v])
      );
    } else {
      Object.assign(headers, headersToSet);
    }
    return headers;
  }
}

export interface MotionOptions {
  userId: string;
  apiKey: string;
  requestLimiter: RateLimiterAbstract;
  overrunLimiter: RateLimiterAbstract;
  maxQueueSize?: number;
}

const defaultQueueSize = 20;

const queueOverflowRegex = /number of requests reached it'?s maximum/;

/** Official rate limits used by Motion
 *
 * NOTE: For additional safety, consider using recommendedRateLimits instead.
 * */
export const motionRateLimits = {
  // Exceeding 12 requests in a minute results in a 1 hr. lockout
  requests: {
    points: 12,
    duration: 60
  },

  // Exceeding 12/min three times in a day results in a permanent lockout.
  // Don't make Harry sad!
  overruns: {
    points: 3,
    duration: 60 * 60 * 24
  }
};

export const recommendedRateLimits = {
  requests: {
    points: motionRateLimits.requests.points - 1,
    duration: motionRateLimits.requests.duration
  },

  overruns: {
    points: 1,
    duration: motionRateLimits.overruns.duration
  }
};
