import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Stepper } from "./stepper";

function S({ initial = 2.5 }: { initial?: number }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <Stepper
        label="Field size"
        value={v}
        onChange={setV}
        min={0.5}
        max={4}
        step={0.5}
        decLabel="Fewer acres"
        incLabel="More acres"
      />
      <output data-testid="v">{v}</output>
    </>
  );
}
const val = () => Number(screen.getByTestId("v").textContent);

describe("Stepper", () => {
  it("labels the buttons and the spinbutton", () => {
    render(<S />);
    expect(screen.getByRole("button", { name: "Fewer acres" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More acres" })).toBeInTheDocument();
    const sb = screen.getByRole("spinbutton", { name: "Field size" });
    expect(sb).toHaveAttribute("aria-valuenow", "2.5");
    expect(sb).toHaveAttribute("aria-valuemin", "0.5");
    expect(sb).toHaveAttribute("aria-valuemax", "4");
  });

  it("keyboard activation steps once per press", async () => {
    render(<S />);
    screen.getByRole("button", { name: "More acres" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(val()).toBe(3);
    await userEvent.keyboard(" ");
    expect(val()).toBe(3.5);
  });

  it("a mouse click steps once (no double step from pointerdown + click)", async () => {
    render(<S />);
    await userEvent.click(screen.getByRole("button", { name: "Fewer acres" }));
    expect(val()).toBe(2);
  });

  it("clamps at the bounds and marks the bound button aria-disabled while keeping focus", async () => {
    render(<S initial={3.5} />);
    const inc = screen.getByRole("button", { name: "More acres" });
    inc.focus();
    for (let i = 0; i < 5; i++) await userEvent.keyboard("{Enter}");
    expect(val()).toBe(4);
    expect(inc).toHaveAttribute("aria-disabled", "true");
    expect(inc).toHaveFocus();
  });

  it("long-press repeats until release and never passes the bound", async () => {
    vi.useFakeTimers();
    render(<S initial={0.5} />);
    const inc = screen.getByRole("button", { name: "More acres" });
    fireEvent.pointerDown(inc, { button: 0 });
    expect(val()).toBe(1);
    await act(async () => {
      vi.advanceTimersByTime(400 + 100 * 2);
    });
    expect(val()).toBe(2.5);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(val()).toBe(4);
    fireEvent.pointerUp(inc);
    fireEvent.click(inc, { detail: 1 });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(val()).toBe(4);
    vi.useRealTimers();
  });

  it("releasing stops the repeat", async () => {
    vi.useFakeTimers();
    render(<S initial={0.5} />);
    const inc = screen.getByRole("button", { name: "More acres" });
    fireEvent.pointerDown(inc, { button: 0 });
    fireEvent.pointerLeave(inc);
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(val()).toBe(1);
    vi.useRealTimers();
  });

  it("accepts Devanagari digits and a decimal comma, clamped; garbage reverts", async () => {
    render(<S />);
    const sb = screen.getByRole("spinbutton", { name: "Field size" });
    await userEvent.clear(sb);
    await userEvent.type(sb, "३,५{Enter}");
    expect(val()).toBe(3.5);
    await userEvent.clear(sb);
    await userEvent.type(sb, "९९");
    await act(async () => {
      sb.blur();
    });
    expect(val()).toBe(4);
    await userEvent.clear(sb);
    await userEvent.type(sb, "abc");
    await act(async () => {
      sb.blur();
    });
    expect(val()).toBe(4);
    expect(sb).toHaveValue("4");
  });

  it("arrow keys on the value step too", async () => {
    render(<S />);
    screen.getByRole("spinbutton").focus();
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowDown}");
    expect(val()).toBe(3);
  });
});
