import { devUiEnabled } from "./dev-ui";

describe("devUiEnabled", () => {
  it.each([
    ["development", undefined, true],
    ["test", undefined, true],
    ["production", undefined, false],
    ["production", "0", false],
    ["production", "1", true],
  ])("NODE_ENV=%s ENABLE_DEV_UI=%s → %s", (nodeEnv, flag, want) => {
    expect(devUiEnabled({ NODE_ENV: nodeEnv, ENABLE_DEV_UI: flag })).toBe(want);
  });
});
