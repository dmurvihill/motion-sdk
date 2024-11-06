/** This file should not be executed with the regular test suite.
 *
 * It should be added as an ignored pattern in jest.config.js
 *
 * It verifies that Motion's enforced rate limit still matches the
 * constants hard-coded into this package. It should be run only in CI,
 * and not more than once per day.
 * */

import { Motion, motionRateLimits } from "../src/index.js";
import { RateLimiterAbstract, RateLimiterMemory } from "rate-limiter-flexible";
import { LimitExceededError } from "../src/error.js";
import { delay } from "./util/timers.js";
import { Redis } from "ioredis";
import {
  motionClientFromEnvironment,
  redisConfigFromEnvironment,
} from "./util/fixtures.js";
import { motionBaseUrl } from "../src/constant.js";

const rateLimits = motionRateLimits;
const lastSuccessfulTestKey =
  "motion-sdk-dev:last-successful-check-of-rate-limits";

describe("Hardcoded rate limits", () => {
  let redis: Redis;
  let motion: Motion;
  let overruns: number;
  let lastSuccessfulTest: Date | null;

  beforeAll(async () => {
    redis = new Redis(redisConfigFromEnvironment());
    motion = await motionClientFromEnvironment(redis, motionBaseUrl);
    overruns =
      (await motion.overrunLimiter.get(motion.overrunLimiterKey))
        ?.consumedPoints ?? 0;
    const lastSuccessfulTestResult = await redis.get(lastSuccessfulTestKey);
    console.log(
      lastSuccessfulTestResult !== null
        ? `Last successful test of hardcoded rate limits was ${lastSuccessfulTestResult}`
        : `No previous successful test of hardcoded rate limits`,
    );
    lastSuccessfulTest = lastSuccessfulTestResult
      ? new Date(lastSuccessfulTestResult)
      : null;
  });

  afterAll(async () => {
    if (motion.isOpen()) {
      motion.close("Test complete");
    }
    await redis.quit();
  });

  it(
    "Hardcoded rate limits should match what Motion enforces",
    async () => {
      log("Test started");
      let client: Motion | MockClient;
      if (overruns === 0) {
        client = motion;
        expect(client.isOpen()).toBe(true);
      } else {
        const thirtyDaysInMs = 1000 * 60 * 60 * 24 * 30;
        if (lastSuccessfulTest === null) {
          throw new Error(
            `Motion's rate limits have never been verified, and we can\`t test today as we already have an overrun.`,
          );
        } else if (lastSuccessfulTest.valueOf() < Date.now() - thirtyDaysInMs) {
          throw new Error(
            `Motion's rate limits were last verified on ${lastSuccessfulTest.toISOString()}, more than 30 days ago.`,
          );
        }
        console.log(
          `We already have ${overruns === 1 ? "an overrun" : `${overruns.toString()} overruns`} today. Doing a dry run this time.`,
        );
        const limiter = new RateLimiterMemory(rateLimits.requests);
        client = new MockClient(limiter);
      }
      const testUrl = "/users/me";
      const promises = [];
      for (let i = 0; i < rateLimits.requests.points - 1; i++) {
        promises.push(client.unsafe_fetch(testUrl));
      }
      await Promise.all(
        promises.map((p) => expect(p).resolves.toMatchObject({ ok: true })),
      );
      await delay((rateLimits.requests.duration - 1) * 1000);
      await expect(client.unsafe_fetch(testUrl)).resolves.toMatchObject({
        ok: true,
      });
      await expect(client.unsafe_fetch(testUrl)).resolves.toBeInstanceOf(
        LimitExceededError,
      );
      if (client instanceof Motion && client.baseUrl === motionBaseUrl) {
        await redis.set(lastSuccessfulTestKey, new Date().toISOString());
      }
    },
    (rateLimits.requests.duration + 10) * 1000,
  );

  class MockClient {
    requests = 0;

    constructor(readonly limiter: RateLimiterAbstract) {}

    async unsafe_fetch(url: string) {
      const seq = (this.requests++).toString().padStart(2, "0"); // Thanks, Azer!
      console.log(`${new Date().toISOString()} Request ${seq} starts`);
      return this.limiter
        .consume("", 1)
        .then(() => new Response(`Request ${seq} ok; ${url}`))
        .catch(
          () =>
            new LimitExceededError(
              new Response(`limit exceeded on request ${seq}; ${url}`),
            ),
        )
        .finally(() => {
          log(`Request ${seq} ended`);
        });
    }
  }
});

function log(msg: string) {
  console.log(`${new Date().toISOString()} ${msg}`);
}
