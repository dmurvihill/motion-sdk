# Motion-SDK

Unofficial JavaScript SDK for [Motion](https://app.usemotion.com/)

[x] Node 18+
[ ] Browsers
[x]ESM
[ ] CJS
[x] 100% Coverage
[x] TypeScript-native

Made with love in Portland, OR

# Getting started

```bash
npm install motion-sdk
```

Follow [Motion's](TODO) instructions for generating an API key.

```bash
export MOTION_USER_ID=""
export MOTION_API_KEY=""
```

(TODO test this)

```js
const motion = new Motion({
  userId: process.env.MOTION_USER_ID,
  apiKey: process.env.MOTION_API_KEY,
});

await motion.fetch("/users/me");

/*
{
  "id": "aoeu",
  "name": "Jacob Bitz",
  "email": "jacob@example.com"
}
 */

motion.close();
```

(TODO fancy warning box)
Warning: Motion has very strict rate limits. If the same Motion user
will be calling the Motion API from multiple sources, see [Rate Limitng](), below.

# API reference

TODO generate this

## Low Level: `fetch`

## Very Low Level: `unsafe_fetch`

## Exceptions

`motion-sdk` doesn't throw errors (and you shouldn't either).

If an error occurs during any call to `Motion`, a `MotionError` will be
returned. You can determine whether there was an error by the presence
of a key `errorType` in the returned object.

Errors that originate from `motion-sdk`'s dependencies are caught,
wrapped in an appropriate `MotionError`, and returned.

## Rate Limiting

`motion-sdk` will stay under the API rate limit as long as there is only
a single `Motion` instance associated with a particular user. Any requests
that would exceed the rate limit will be queued up to a maximum queue length. If you are
making API requests from multiple sources, you have to configure custom
rate limiters.

Motion has two rate limits:

1. You may not exceed 12 requests in a minute, or you get locked out for an hour
2. You may not get locked out three times in a day, or you get locked out permanently

`Motion` uses the `rate-limiter-flexible` package to stay beneath the
rate limits. By default, an in-memory limiter is used. To support
multiple clients from the same user account, you will have to supply the
`Motion` constructor with two `RateLimiterAbstract` instances:

```js
const redis = new Redis({
  host: process.env.REDIS_HOST,
  username: process.env.REDIS_USER,
  password: process.env.REDIS_PASS,
});
const motion = new Motion({
  userId: process.env.MOTION_USER_ID,
  apiKey: process.env.MOTION_API_KEY,
  requestLimiter: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rate-limit-motion",
    ...recommendedRateLimits.requests,
  }),
  overrunLimiter: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rate-limit-motion",
    ...recommendedRateLimits.requests,
  }),
});
```

`rate-limiter-flexible` provides a number of convenient rate limiter
implementations, including Redis which is used to synchronize this
project's tests.
