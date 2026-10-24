import { act, screen } from "@testing-library/react";
import { renderIntl } from "@/lib/test-intl";
import { Counters } from "./counters";

const items = [
  { value: 86, decimals: 0, suffix: "%", label: "small farms", sr: "86% of farm holdings are small." },
  {
    value: 1.08,
    decimals: 2,
    suffix: "",
    label: "hectare avg. farm",
    sr: "The average farm is 1.08 hectares.",
  },
  { value: 47, decimals: 0, suffix: "%", label: "mechanised", sr: "About 47% is mechanised." },
];
const visible = () => document.querySelector<HTMLElement>("[aria-hidden=true]")!.textContent;

let reduced = false;
let io: ((e: { isIntersecting: boolean }[]) => void) | undefined;
let raf: ((t: number) => void)[] = [];

beforeEach(() => {
  reduced = false;
  io = undefined;
  raf = [];
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        io = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => raf.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Counters", () => {
  it("starts at 0, counts once visible and finishes on exactly the targets", () => {
    renderIntl(<Counters items={items} label="Key facts" source="src" />);
    expect(visible()).toContain("0%");
    expect(visible()).toContain("0.00");
    vi.spyOn(performance, "now").mockReturnValue(0);
    act(() => io?.([{ isIntersecting: true }]));
    act(() => raf.shift()?.(900)); // half way: ease-out puts it past 80 %
    expect(Number.parseFloat(visible())).toBeGreaterThan(50);
    act(() => raf.shift()?.(1800));
    expect(visible()).toContain("86%");
    expect(visible()).toContain("1.08");
    expect(visible()).toContain("47%");
    expect(raf).toHaveLength(0); // stopped: it runs once
  });
  it("does not count while off screen", () => {
    renderIntl(<Counters items={items} label="Key facts" source="src" />);
    act(() => io?.([{ isIntersecting: false }]));
    expect(raf).toHaveLength(0);
    expect(visible()).toContain("0%");
  });
  it("reduced motion shows the final values at once", () => {
    reduced = true;
    renderIntl(<Counters items={items} label="Key facts" source="src" />);
    expect(visible()).toContain("86%");
    expect(visible()).toContain("47%");
    expect(raf).toHaveLength(0);
  });
  it("keeps the final sentences for screen readers and hides the animated numbers", () => {
    renderIntl(<Counters items={items} label="Key facts" source="src" />);
    expect(screen.getByRole("region", { name: "Key facts" })).toBeInTheDocument();
    expect(screen.getByText("86% of farm holdings are small.")).toBeInTheDocument();
    expect(document.querySelector("[aria-hidden=true]")).toBeInTheDocument();
  });
});
