/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

import { MotionRateLimits } from "./motion.js";

export const motionBaseUrl = "https://api.usemotion.com/v1" as const;
export const motionMockBaseUrl =
  "https://stoplight.io/mocks/motion/motion-rest-api/33447" as const;

export const invalidOptionErrorType = "INVALID_OPTION" as const;
export const fetchErrorType = "FETCH_ERROR" as const;
export const limiterErrorType = "MOTION_LIMITER_ERROR" as const;
export const queueOverflowErrorType = "MOTION_LIMITER_QUEUE_EXCEEDED" as const;
export const closedErrorType = "MOTION_CLIENT_CLOSED" as const;
export const limitExceededErrorType = "MOTION_API_RATE_LIMIT_EXCEEDED" as const;
export const multiErrorType = "MOTION_MULTI_ERROR" as const;

export const defaultQueueSize = 20;
/** Official rate limits used by Motion
 *
 * NOTE: For additional safety, consider using recommendedRateLimits instead.
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
