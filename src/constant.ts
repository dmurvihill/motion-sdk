/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

export const fetchErrorType = "FETCH_ERROR" as const;
export const limiterErrorType = "MOTION_LIMITER_ERROR";
export const queueOverflowErrorType = "MOTION_LIMITER_QUEUE_EXCEEDED" as const;
export const closedErrorType = "MOTION_CLIENT_CLOSED";
export const limitExceededErrorType = "MOTION_API_RATE_LIMIT_EXCEEDED" as const;
export const multiErrorType = "MOTION_MULTI_ERROR" as const;
