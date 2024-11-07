/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

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
