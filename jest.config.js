// @ts-check

/** @type {import("jest").Config} */
export default {
  transform: {
    "^.+\\.ts?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  setupFiles: ["dotenv/config", "./jest.setup.ts"],
  testPathIgnorePatterns: [
    "__tests__/util/",
    "__tests__/limiter/",
    "__tests__/responses/",
    "__tests__/motion-rate-limits.test.ts",
  ],
  collectCoverage: true,
  collectCoverageFrom: ["src/**"],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
