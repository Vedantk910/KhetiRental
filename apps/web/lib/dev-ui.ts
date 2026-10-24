/** The /dev/ui gallery: any non-production build, or production with ENABLE_DEV_UI=1 (Playwright). */
export const devUiEnabled = (env: { NODE_ENV?: string; ENABLE_DEV_UI?: string } = process.env) =>
  env.NODE_ENV !== "production" || env.ENABLE_DEV_UI === "1";
