import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // Every test that installs a hook or writes state passes its own temporary home. HOME,
    // BOOKSGUARD_HOME, CLAUDE_CONFIG_DIR and CODEX_HOME point at paths that cannot exist, so a test
    // that forgot cannot reach the real ~/.claude, ~/.codex, ~/.gemini or ~/.booksguard.
    env: {
      TZ: "UTC",
      HOME: "/nonexistent/booksguard-tests-home",
      BOOKSGUARD_HOME: "/nonexistent/booksguard-tests-must-pass-a-home",
      CLAUDE_CONFIG_DIR: "/nonexistent/booksguard-tests-claude",
      CODEX_HOME: "/nonexistent/booksguard-tests-codex",
    },
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
