import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  globalSetup: "<rootDir>/jest.global-setup.js",
  maxWorkers: 1,
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
  ],
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
};

export default config;
