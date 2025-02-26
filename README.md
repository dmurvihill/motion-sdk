# Motion-SDK

Unofficial JavaScript SDK for [Motion](https://www.usemotion.com/).

:white_check_mark: Node 18+  
:white_check_mark: ESM Only  
:white_check_mark: TypeScript-Native  
:white_check_mark: Comprehensive Documentation  
:white_check_mark: 100% Coverage

:heart: :evergreen_tree: Made with love in Portland, Oregon. :evergreen_tree: :heart:

# Getting started

```bash
npm install motion-sdk
```

Follow [Motion's instructions](https://help.usemotion.com/integrations/integrations-101/api-docs) for generating an API key. Then
set your environment variables:

```bash
export MOTION_USER_ID="my-user-id"
export MOTION_API_KEY="my-api-key"
```

After that, create a `Motion` object and go nuts:

```js
import Motion from "motion-sdk";

const motion = new Motion();
await motion.fetch("/users/me");
/*
{
  "id": "aoeu",
  "name": "Bill Lumbergh",
  "email": "blumbergh@initech.com"
}
*/

// You must give a reason when closing:
motion.close("Finished with the example");
```

The user ID and API key can instead be passed as parameters to the
[constructor](docs%2Fmarkdown%2Fmotion-sdk.motion._constructor_.md).

:warning: :warning: Motion has very strict rate limits. If the same Motion user
will be calling the Motion API from different `Motion` objects, see [Rate Limiting](#rate-limiting), below. :warning: :warning:

# Licensing

`motion-sdk` is offered under the [SSPL](https://en.wikipedia.org/wiki/Server_Side_Public_License).
A waiver of section 13 is available free of charge for users with less
than a million U.S. dollars in annual revenue, otherwise for a reasonable
fee. Contact me for details.

# API reference

Methods for each Motion endpoint are still being implemented. For now,
you should use [Motion.fetch](docs%2Fmarkdown%2Fmotion-sdk.motion.fetch.md), and consult the [official REST API reference](https://docs.usemotion.com/docs/motion-rest-api/44e37c461ba67-motion-rest-api)
for available endpoints.

`Motion.fetch` has built-in rate limiting to avoid hitting the server's
rate limits. To bypass (at your own risk), use [Motion.unsafe_fetch](docs%2Fmarkdown%2Fmotion-sdk.motion.unsafe_fetch.md).

A full API reference is available at [docs/markdown/](docs/markdown/motion-sdk.md).

## Exceptions

`motion-sdk` doesn't throw errors (and you shouldn't either). Instead,
use [type narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) for error flow control.

If an error occurs during any call to `Motion`, a [MotionError](docs%2Fmarkdown%2Fmotion-sdk.motionerror.md) will be
returned. The simplest way to check for an error is with [isMotionError](docs%2Fmarkdown%2Fmotion-sdk.ismotionerror.md),
but you may instead check for the [errorType](docs%2Fmarkdown%2Fmotion-sdk.motionerror.errortype.md) key, which is
guaranteed to be present if and only if there was an error.

`motion-sdk` also provides type guards for each specific
error type ([isArgumentError](docs%2Fmarkdown%2Fmotion-sdk.isargumenterror.md),
[isFetchError](docs%2Fmarkdown%2Fmotion-sdk.isfetcherror.md), etc.). All
of them use the `errorType` key to distinguish the error type.

Errors that originate from `motion-sdk`'s dependencies are caught and
wrapped in an appropriate `MotionError`, which is returned.

## Rate Limiting

Motion has two rate limits:

1. If you exceed 12 requests in a minute, you get locked out for an hour.
2. If you get locked out three times in a day, your API access
   is disabled permanently. You have to email support to get it back.

_(Note: `motion-sdk` is an unofficial package and we are not affiliated
with Motion. Motion's rate limits may change without notice. Consult the
[official API docs](https://docs.usemotion.com/docs/motion-rest-api/44e37c461ba67-motion-rest-api)
to verify the rate limits before using this package.)_

`motion-sdk` will automatically stay under the API rate limit so long as
there is at most one `Motion` instance associated with the same user in
the same day. Any requests that would exceed the rate limit will be queued
up to a maximum queue length (which is configurable in the [constructor](docs%2Fmarkdown%2Fmotion-sdk.motion._constructor_.md)).
If you are making API requests from multiple sources, you must configure
a custom rate limiter.

### Custom Rate Limiters

`Motion` uses the [`rate-limiter-flexible`](https://github.com/animir/node-rate-limiter-flexible)
package to stay beneath the rate limits. By default, an in-memory limiter
is used. To support multiple clients for the same user account, you will
have to supply the `Motion` constructor with two `RateLimiterAbstract`
instances (one for each rate limit).

This example creates a `Motion` object limited by
[`RateLimiterRedis`](https://github.com/animir/node-rate-limiter-flexible/wiki/Redis):

```js
import { Motion, recommendedRateLimits } from "../src/index.js";
import { Redis } from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST,
  username: process.env.REDIS_USER,
  password: process.env.REDIS_PASS,
});
const requestLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rate-limit-motion",
  ...recommendedRateLimits.requests,
});
const overrunLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rate-limit-motion",
  ...recommendedRateLimits.requests,
});
const motion = new Motion({
  requestLimiter,
  overrunLimiter,
});
```

[`recommendedRateLimits`](docs/markdown/motion-sdk.recommendedratelimits.md)
leaves a small headroom in case edge-case bugs cause more requests than
expected. If you want slightly greater throughput and like to live dangerously,
you can use [`motionRateLimits`](docs/markdown/motion-sdk.motionratelimits.md).

`rate-limiter-flexible` provides a number of convenient rate limiter
implementations. This project uses `RateLimiterRedis` to synchronize
its CI pipeline.

## Contributing

See [CONTRIBUTING](CONTRIBUTING.md).
