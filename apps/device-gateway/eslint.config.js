import { config } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    languageOptions: {
      globals: {
        Buffer: "readonly",
        URL: "readonly",
        console: "readonly",
        process: "readonly",
      },
    },
  },
];
