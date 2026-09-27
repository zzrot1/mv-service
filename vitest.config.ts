import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret",
      // Nu se conecteaza nimeni la ea: testele folosesc PGlite in memorie.
      DATABASE_URL: "postgresql://unused:unused@localhost:1/unused",
      EMAIL_DRIVER: "disabled",
    },
  },
});
