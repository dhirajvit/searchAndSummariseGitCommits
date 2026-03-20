import type { Config } from "jest";

  const config: Config = {
    testEnvironment: "jsdom",
    transform: {
      "^.+\\.tsx?$": "ts-jest",
    },
    moduleNameMapper: {
      "^@/(.*)$": "<rootDir>/$1",
    },
    setupFilesAfterEnv: ["@testing-library/jest-dom"],
  };

  export default config;