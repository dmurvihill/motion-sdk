# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0]

### Added

- `Motion` API client with `fetch`, `unsafe_fetch`, configurable Motion
  credentials, and configurable rate limiter.
- Initial error types `MotionError`, `ArgumentError`, `ClosedError`,
  `FetchError`, `LimiterError`, `LimitExceededError`, `MultiError`, and
  `QueueOverflowError`, with corresponding type guard functions.
- Constants for built-in rate limits
- Constants for live and mock Motion API URLs.

[0.1.0]: https://github.com/dmurvihill/motion-sdk/releases/tag/v0.1.0
