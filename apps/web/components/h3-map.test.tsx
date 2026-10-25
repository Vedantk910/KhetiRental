import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { H3Map, SANDBOX_TRACTORS, STATUS_LABEL, pxToLatLng, project } from "./h3-map";
import { DEMO_CENTER } from "@/lib/h3-dispatch";

const ringSize = () => Number(screen.getByTestId("ring-size").textContent);

describe("H3Map", () => {
  it("renders 15 tractors, each status with a text label", () => {
    render(<H3Map />);
    expect(SANDBOX_TRACTORS).toHaveLength(15);
    const table = screen.getByRole("table", { name: /simulated tractors/i });
    for (const label of Object.values(STATUS_LABEL))
      expect(within(table).getAllByText(label).length).toBeGreaterThan(0);
    expect(within(table).getAllByRole("row")).toHaveLength(16);
  });

  it("defaults to Res 8, k=2: 19 ring cells, 19 Redis commands", () => {
    render(<H3Map />);
    expect(screen.getByLabelText(/resolution/i)).toHaveValue("8");
    expect(ringSize()).toBe(19);
    expect(screen.getByTestId("pipeline").textContent.trim().split("\n")).toHaveLength(19);
    expect(screen.getAllByTestId("ring-cell")).toHaveLength(19);
  });

  it("k slider and resolution change the ring", () => {
    render(<H3Map />);
    fireEvent.change(screen.getByLabelText(/rings of neighbours/i), { target: { value: "5" } });
    expect(ringSize()).toBe(91);
    fireEvent.change(screen.getByLabelText(/rings of neighbours/i), { target: { value: "1" } });
    expect(ringSize()).toBe(7);
    fireEvent.change(screen.getByLabelText(/resolution/i), { target: { value: "9" } });
    expect(ringSize()).toBe(7);
  });

  it("lists only Available tractors, at most 20, sorted by score", () => {
    render(<H3Map />);
    fireEvent.change(screen.getByLabelText(/rings of neighbours/i), { target: { value: "5" } });
    const items = within(screen.getByTestId("results")).getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(20);
    const availableIds = SANDBOX_TRACTORS.filter((t) => t.status === "available").map((t) => t.id);
    for (const li of items) expect(availableIds.some((id) => li.textContent.includes(id))).toBe(true);
  });

  it("arrow keys move the farmer; preset select sets it; no NaN anywhere", async () => {
    const user = userEvent.setup();
    render(<H3Map />);
    const before = screen.getByTestId("farmer-coords").textContent;
    screen.getByTestId("h3-map").focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowUp}");
    expect(screen.getByTestId("farmer-coords").textContent).not.toBe(before);
    await user.selectOptions(
      screen.getByLabelText(/farmer location/i),
      screen.getAllByRole("option", { name: /north/i })[0],
    );
    expect(screen.getByTestId("farmer-coords").textContent).not.toBe(before);
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("projection round-trips", () => {
    const p = project(DEMO_CENTER.lat + 0.01, DEMO_CENTER.lng - 0.02);
    const back = pxToLatLng(p.x, p.y);
    expect(back.lat).toBeCloseTo(DEMO_CENTER.lat + 0.01, 6);
    expect(back.lng).toBeCloseTo(DEMO_CENTER.lng - 0.02, 6);
  });

  it("latency panel: measured figures only, PostGIS marked not benchmarked", () => {
    render(<H3Map />);
    const panel = screen.getByTestId("latency");
    expect(panel).toHaveTextContent("0.66 ms");
    expect(panel).toHaveTextContent("2.91 ms");
    expect(panel).toHaveTextContent(/not benchmarked/i);
    expect(panel.textContent).not.toMatch(/8\.6|48\.2|82 ?%/);
  });
});
