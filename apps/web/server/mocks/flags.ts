/** Local mocks may reveal secrets (OTP codes, reset links) in the log only outside production, or in e2e runs. */
export const mocksMayLog = () =>
  process.env.NODE_ENV !== "production" || process.env.ENABLE_MOCK_AUTH === "1";

/** The "Mock Google" sign-in exists only when no real Google keys are set (README, D-05). */
export const mockGoogleEnabled = () => !process.env.AUTH_GOOGLE_ID && mocksMayLog();
