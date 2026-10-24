import { defineConfig } from "@playwright/test";
import { E2E_AUTH_SECRET, E2E_DATABASE_URL } from "./e2e/db";

const PORT = 3217;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/en`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      // The /dev/ui gallery is off in production builds unless this is set.
      ENABLE_DEV_UI: "1",
      // Mock Google sign-in and logged OTP codes in this production build (never set in a real deployment).
      ENABLE_MOCK_AUTH: "1",
      DATABASE_URL: E2E_DATABASE_URL,
      AUTH_SECRET: E2E_AUTH_SECRET,
      DEMO_PAYMENT_DELAY_MS: "0",
    },
  },
});
