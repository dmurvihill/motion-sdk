/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

import { MotionRateLimits } from "./motion.js";

/** Location of the live API
 *
 * @public
 */
export const motionBaseUrl = "https://api.usemotion.com/v1" as const;

/** Location of the mock API
 *
 * @public
 */
export const motionMockBaseUrl =
  "https://stoplight.io/mocks/motion/motion-rest-api/33447" as const;

/** An illegal argument was passed to a function or method
 *
 * @public
 */
export const argumentErrorType = "ARGUMENT_ERROR" as const;

/** There was an error in making the request
 *
 * @public
 */
export const fetchErrorType = "FETCH_ERROR" as const;

/** An error prevented checking or updating the rate limit
 *
 * @public
 * */
export const limiterErrorType = "MOTION_LIMITER_ERROR" as const;

/** Too many waiting requests already
 *
 * @public
 * */
export const queueOverflowErrorType = "MOTION_LIMITER_QUEUE_EXCEEDED" as const;

/** The client is already closed
 *
 * @public
 * */
export const closedErrorType = "MOTION_CLIENT_CLOSED" as const;

/** Motion returned 429 Limit Exceeded; we have overrun the rate limit
 *
 * @public
 * */
export const limitExceededErrorType = "MOTION_API_RATE_LIMIT_EXCEEDED" as const;

/** Multiple errors occurred
 *
 * @public
 * */
export const multiErrorType = "MOTION_MULTI_ERROR" as const;

/** Number of requests that can be queued to comply with the rate limit
 *
 * Override with {@link MotionOptions.maxQueueSize}
 *
 * @public
 * */
export const defaultQueueSize = 20;

/** Official rate limits used by Motion
 *
 * NOTE: For additional safety, consider using {@link recommendedRateLimits} instead.
 *
 * @public
 * */
export const motionRateLimits: MotionRateLimits = {
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

/** Internal rate limits with a small headroom against the official limits
 *
 * @public
 */
export const recommendedRateLimits: MotionRateLimits = {
  requests: {
    points: motionRateLimits.requests.points - 1,
    duration: motionRateLimits.requests.duration,
  },

  overruns: {
    points: 1,
    duration: motionRateLimits.overruns.duration,
  },
};
