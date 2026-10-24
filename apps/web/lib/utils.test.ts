import { cn } from "./utils";

describe("cn", () => {
  it("joins classes and drops falsy values", () => {
    const off: boolean = "".length > 1;
    expect(cn("a", off && "b", undefined, "c")).toBe("a c");
  });
  it("lets later tailwind classes override earlier conflicting ones", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
