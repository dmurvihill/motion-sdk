# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `Motion` API client with `fetch`, `unsafe_fetch`, 
- Initial error types `MotionError`, `ArgumentError`, `ClosedError`, `FetchError`, `LimiterError`, `LimitExceededError`, `MultiError`, and `QueueOverflowError`, with type guard functions.
- Constants for built-in rate limits and live and mock Motion API URLs.

[unreleased]: https://github.com/dmurvihill/motion-sdk/tree/main/
