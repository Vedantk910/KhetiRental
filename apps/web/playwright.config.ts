import { defineConfig } from "@playwright/test";

const PORT = 3217;

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/en`,
    reuseExistingServer: false,
    timeout: 60_000,
    // The /dev/ui gallery is off in production builds unless this is set.
    env: { ENABLE_DEV_UI: "1" },
  },
});
