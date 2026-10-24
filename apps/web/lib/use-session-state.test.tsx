import { fireEvent, render, screen } from "@testing-library/react";
import { useSessionState } from "./use-session-state";

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
