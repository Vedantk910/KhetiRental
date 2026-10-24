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

describe("cn with Mitti tokens", () => {
  it("keeps a Mitti font size next to a colour", () => {
    expect(cn("text-label text-action-on")).toBe("text-label text-action-on");
  });
  it("later Mitti font size wins", () => {
    expect(cn("text-body", "text-label")).toBe("text-label");
  });
});
