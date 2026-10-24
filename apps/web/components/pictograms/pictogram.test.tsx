import { render } from "@testing-library/react";
import { JOBS, MACHINES, Pictogram } from "./pictogram";

describe("Pictogram", () => {
  it("has every job and machine from UI-SPEC §5.12", () => {
    expect(JOBS).toEqual(["plough", "rotavate", "sow", "spray", "harvest", "transport"]);
    expect(MACHINES).toEqual([
      "tractor",
      "rotavator",
      "combine",
      "sprayer",
      "seedDrill",
      "trolley",
      "thresher",
      "baler",
    ]);
  });

  it.each([...JOBS, ...MACHINES])("%s: 32 px, 2 px currentColor stroke, decorative by default", (name) => {
    const { container } = render(<Pictogram name={name} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("stroke-width", "2");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelectorAll("path, circle, rect").length).toBeGreaterThan(1);
  });

  it("the mustard accent is optional", () => {
    const off = render(<Pictogram name="tractor" />).container;
    const on = render(<Pictogram name="tractor" accent />).container;
    expect(off.querySelector("[data-accent]")).toBeNull();
    expect(on.querySelector("[data-accent]")).not.toBeNull();
  });

  it("with a title it is an image with a name", () => {
    const { getByRole } = render(<Pictogram name="baler" title="Baler" />);
    expect(getByRole("img", { name: "Baler" })).toBeInTheDocument();
  });
});
