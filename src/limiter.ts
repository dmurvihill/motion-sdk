import { RateLimiterQueue } from "rate-limiter-flexible";

export function limitWith<Args extends unknown[], Return>(
  queue: RateLimiterQueue,
) {
  return (f: (...args: Args) => Return) => {
    return async (...args: Args) => {
      await queue.removeTokens(1);
      return f(...args);
    };
  };
}
