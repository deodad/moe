import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3001",
    browserName: "chromium",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/e2e/start-server.mjs",
    url: "http://localhost:3001",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      MOE_DATABASE_PATH: "/tmp/moe-playwright.db",
      OPENAI_API_KEY: "test-key",
      NANOCODEX_WEBSOCKET_URL: "ws://127.0.0.1:43991",
    },
  },
});
