import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderIntl } from "@/lib/test-intl";
import { OtpInput } from "./otp-input";

function Harness({ onCode }: { onCode?: (c: string) => void }) {
  const [v, setV] = useState("");
  return (
    <OtpInput
      value={v}
      onChange={(c) => {
        setV(c);
        onCode?.(c);
      }}
    />
  );
}
const boxes = () => screen.getAllByRole<HTMLInputElement>("textbox");

describe("OtpInput", () => {
  it("has six labelled boxes", () => {
    renderIntl(<Harness />);
    expect(boxes()).toHaveLength(6);
    expect(screen.getByRole("textbox", { name: "Digit 1 of 6" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "6-digit code" })).toBeInTheDocument();
  });
  it("auto-advances while typing", async () => {
    const user = userEvent.setup();
    renderIntl(<Harness />);
    await user.click(boxes()[0]);
    await user.keyboard("123");
    expect(
      boxes()
        .map((b) => b.value)
        .join(""),
    ).toBe("123");
    expect(boxes()[3]).toHaveFocus();
  });
  it("paste fills all six", async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    renderIntl(<Harness onCode={(c) => seen.push(c)} />);
    await user.click(boxes()[2]);
    await user.paste("654 321");
    expect(
      boxes()
        .map((b) => b.value)
        .join(""),
    ).toBe("654321");
    expect(seen.at(-1)).toBe("654321");
  });
  it("an SMS autofill landing in one box fills all six", () => {
    renderIntl(<Harness />);
    fireEvent.change(boxes()[0], { target: { value: "135790" } });
    expect(
      boxes()
        .map((b) => b.value)
        .join(""),
    ).toBe("135790");
  });
  it("accepts Devanagari digits and ignores letters", async () => {
    const user = userEvent.setup();
    renderIntl(<Harness />);
    await user.click(boxes()[0]);
    await user.keyboard("a१२");
    expect(
      boxes()
        .map((b) => b.value)
        .join(""),
    ).toBe("12");
  });
  it("backspace on an empty box clears and steps back", async () => {
    const user = userEvent.setup();
    renderIntl(<Harness />);
    await user.click(boxes()[0]);
    await user.keyboard("12");
    await user.keyboard("{Backspace}");
    expect(boxes()[1].value).toBe("");
    expect(boxes()[1]).toHaveFocus();
    await user.keyboard("{Backspace}");
    expect(boxes()[0].value).toBe("");
  });
});
