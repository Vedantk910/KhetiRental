import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom has no matchMedia
window.matchMedia ??= ((q: string) => ({
  matches: false, media: q, addEventListener() {}, removeEventListener() {},
})) as unknown as typeof window.matchMedia;
