import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom has no matchMedia
if (!(window as { matchMedia?: unknown }).matchMedia) {
  Object.assign(window, {
    matchMedia: (q: string) => ({
      matches: false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
}
