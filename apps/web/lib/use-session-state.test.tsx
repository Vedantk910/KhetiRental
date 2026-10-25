import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { markLanguageSwitch, useSessionState } from "./use-session-state";

function F({ k }: { k: string }) {
  const [v, setV] = useSessionState(k, "");
  return (
    <input
      aria-label="name"
      value={v}
      onChange={(e) => {
        setV(e.target.value);
      }}
    />
  );
}

describe("useSessionState", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("survives a remount (e.g. the language switch re-rendering the page)", () => {
    const a = render(<F k="t1" />);
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Ramesh" } });
    a.unmount();
    render(<F k="t1" />);
    expect(screen.getByLabelText("name")).toHaveValue("Ramesh");
  });

  it("falls back to the initial value when storage is unavailable or corrupt", () => {
    sessionStorage.setItem("kr:t2", "{not json");
    render(<F k="t2" />);
    expect(screen.getByLabelText("name")).toHaveValue("");
  });
});

describe("useSessionState onlyAfterSwitch", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("restores right after a language switch, never on a later visit", () => {
    const a = renderHook(() => useSessionState("t.sw", "", { onlyAfterSwitch: true }));
    act(() => {
      a.result.current[1]("Latur");
    });
    a.unmount();

    const later = renderHook(() => useSessionState("t.sw", "", { onlyAfterSwitch: true }));
    expect(later.result.current[0]).toBe(""); // an ordinary visit starts from the link or cookie
    later.unmount();

    markLanguageSwitch();
    const after = renderHook(() => useSessionState("t.sw", "", { onlyAfterSwitch: true }));
    expect(after.result.current[0]).toBe("Latur");
  });

  it("accepts an updater function", () => {
    const h = renderHook(() => useSessionState("t.fn", "a"));
    act(() => {
      h.result.current[1]((x) => `${x}b`);
    });
    expect(h.result.current[0]).toBe("ab");
    expect(sessionStorage.getItem("kr:t.fn")).toBe('"ab"');
  });
});
