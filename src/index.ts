import Motion from "./motion.js";

export default Motion;
export * from "./constant.js";
export {
  Motion,
  MotionOptions,
  MotionRateLimits,
  ClosedReason,
} from "./motion.js";
export {
  MotionError,
  ArgumentError,
  FetchError,
  ClosedError,
  LimitExceededError,
  MultiError,
  LimiterError,
  QueueOverflowError,
  isMotionError,
  isFetchError,
  isLimitExceededError,
  isMultiError,
  UnsafeFetchError,
  UnsafeFetchIndividualError,
  MotionFetchError,
  FetchIndividualError,
} from "./error.js";
