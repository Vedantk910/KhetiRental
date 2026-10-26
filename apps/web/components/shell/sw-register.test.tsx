import { render } from "@testing-library/react";
import { ServiceWorkerRegister } from "./sw-register";

const register = vi.fn(() => Promise.resolve({}));
beforeEach(() => {
  register.mockClear();
  Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ServiceWorkerRegister", () => {
  it("registers /sw.js in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<ServiceWorkerRegister />);
    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("does nothing in development or test", () => {
    for (const env of ["development", "test"]) {
      vi.stubEnv("NODE_ENV", env);
      render(<ServiceWorkerRegister />);
    }
    expect(register).not.toHaveBeenCalled();
  });

  it("survives a browser that refuses", async () => {
    vi.stubEnv("NODE_ENV", "production");
    register.mockRejectedValueOnce(new Error("blocked"));
    render(<ServiceWorkerRegister />);
    await Promise.resolve();
    expect(register).toHaveBeenCalledTimes(1);
  });
});
