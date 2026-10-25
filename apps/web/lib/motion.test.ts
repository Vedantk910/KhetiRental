import { describe, expect, it, vi } from "vitest";
import { MOTION_SCRIPT } from "./motion";

type Env = {
  reduce?: boolean;
  saveData?: boolean;
  effectiveType?: string;
  memory?: number;
  cores?: number;
  noConnection?: boolean;
  noMatchMedia?: boolean;
};

/** Runs the real inline script against a fake browser and returns the document element and the change listeners. */
function run(env: Env = {}) {
  const html = { dataset: {} as Record<string, string> };
  const listeners: Array<() => void> = [];
  const mql = {
    matches: !!env.reduce,
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
  };
  const nav = {
    deviceMemory: env.memory,
    hardwareConcurrency: "cores" in env ? env.cores : 8,
    connection: env.noConnection
      ? undefined
      : { saveData: !!env.saveData, effectiveType: env.effectiveType ?? "4g", addEventListener: vi.fn() },
  };
  const matchMedia = env.noMatchMedia
    ? () => {
        throw new Error("no matchMedia");
      }
    : () => mql;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- runs the shipped inline script against a fake browser
  new Function("navigator", "matchMedia", "document", MOTION_SCRIPT)(nav, matchMedia, {
    documentElement: html,
  });
  return { html, mql, listeners, nav };
}

describe("data-motion detector", () => {
  it("is rich on a capable device", () => {
    expect(run({ noConnection: true }).html.dataset.motion).toBe("rich");
    expect(run({ memory: 8, cores: 8 }).html.dataset.motion).toBe("rich");
  });
  it("treats unknown memory as 4 GB (capable) but unknown cores as 4 (lite), as the spec's defaults say", () => {
    expect(run({ memory: undefined }).html.dataset.motion).toBe("rich");
    expect(run({ cores: undefined }).html.dataset.motion).toBe("lite");
  });
  it("is none under prefers-reduced-motion, whatever the device", () => {
    expect(run({ reduce: true, memory: 8, cores: 16 }).html.dataset.motion).toBe("none");
    expect(run({ reduce: true, saveData: true }).html.dataset.motion).toBe("none");
  });
  it("is lite with Save-Data", () => {
    expect(run({ saveData: true }).html.dataset.motion).toBe("lite");
  });
  it.each(["slow-2g", "2g", "3g"])("is lite on a %s connection", (effectiveType) => {
    expect(run({ effectiveType }).html.dataset.motion).toBe("lite");
  });
  it("stays rich on 4g", () => {
    expect(run({ effectiveType: "4g" }).html.dataset.motion).toBe("rich");
  });
  it("is lite below 4 GB of memory and rich at exactly 4", () => {
    expect(run({ memory: 2 }).html.dataset.motion).toBe("lite");
    expect(run({ memory: 3.9 }).html.dataset.motion).toBe("lite");
    expect(run({ memory: 4 }).html.dataset.motion).toBe("rich");
  });
  it("is lite below 6 cores and rich at exactly 6", () => {
    expect(run({ cores: 4 }).html.dataset.motion).toBe("lite");
    expect(run({ cores: 5 }).html.dataset.motion).toBe("lite");
    expect(run({ cores: 6 }).html.dataset.motion).toBe("rich");
  });
  it("falls back to lite if anything throws", () => {
    expect(run({ noMatchMedia: true }).html.dataset.motion).toBe("lite");
  });
  it("re-evaluates live when reduced motion or the connection changes", () => {
    const { html, mql, listeners, nav } = run({});
    expect(html.dataset.motion).toBe("rich");
    mql.matches = true;
    listeners.forEach((fn) => {
      fn();
    });
    expect(html.dataset.motion).toBe("none");
    mql.matches = false;
    nav.connection!.saveData = true;
    listeners.forEach((fn) => {
      fn();
    });
    expect(html.dataset.motion).toBe("lite");
    expect(nav.connection!.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
