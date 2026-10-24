import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ChipGroup } from "./chip-group";

const OPTS = [
  { value: "tomorrow", label: "Tomorrow" },
  { value: "week", label: "This week" },
  { value: "pick", label: "Pick dates" },
];

function Single() {
  const [v, setV] = useState("week");
  return <ChipGroup label="When?" options={OPTS} value={v} onChange={setV} />;
}
function Multi() {
  const [v, setV] = useState<string[]>([]);
  return <ChipGroup label="Jobs" multiple options={OPTS} value={v} onChange={setV} />;
}

describe("ChipGroup single", () => {
  it("is a radiogroup with one checked radio and roving tabindex", () => {
    render(<Single />);
    expect(screen.getByRole("radiogroup", { name: "When?" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  it("arrow keys move focus and selection, wrapping; Home/End jump", async () => {
    render(<Single />);
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "This week" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Pick dates" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Pick dates" })).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Tomorrow" })).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Pick dates" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "Tomorrow" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "Pick dates" })).toHaveAttribute("aria-checked", "true");
  });

  it("click selects", async () => {
    render(<Single />);
    await userEvent.click(screen.getByRole("radio", { name: "Tomorrow" }));
    expect(screen.getByRole("radio", { name: "Tomorrow" })).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true"),
    ).toHaveLength(1);
  });

  it("with no value, the first chip is the tab stop", () => {
    render(<ChipGroup label="When?" options={OPTS} value="" onChange={() => {}} />);
    expect(screen.getAllByRole("radio").map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  });
});

describe("ChipGroup multi", () => {
  it("is a group of toggle buttons; arrows move focus only; Space toggles", async () => {
    render(<Multi />);
    expect(screen.getByRole("group", { name: "Jobs" })).toBeInTheDocument();
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    const week = screen.getByRole("button", { name: "This week" });
    expect(week).toHaveFocus();
    expect(week).toHaveAttribute("aria-pressed", "false");
    await userEvent.keyboard(" ");
    expect(week).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
    await userEvent.click(week);
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "true",
      "false",
      "false",
    ]);
  });

  it("keyboard spam leaves exactly one tab stop", async () => {
    render(<Multi />);
    await userEvent.tab();
    for (let i = 0; i < 50; i++) await userEvent.keyboard(i % 3 ? "{ArrowRight}" : "{ArrowLeft} ");
    expect(screen.getAllByRole("button").filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(document.activeElement?.getAttribute("tabindex")).toBe("0");
  });
});

describe("ChipGroup tiles", () => {
  it("renders the icon and label inside each tile", () => {
    render(
      <ChipGroup
        variant="tile"
        label="What work?"
        options={[{ value: "plough", label: "Plough", icon: <svg data-testid="ico" /> }]}
        value="plough"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("radio", { name: "Plough" })).toContainElement(screen.getByTestId("ico"));
  });
});
