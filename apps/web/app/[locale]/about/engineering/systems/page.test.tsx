import { render, screen } from "@testing-library/react";
import SystemsDossier from "./page";
import { LOAD_TEST_RUNS } from "@/lib/evidence";

describe("Systems dossier", () => {
  it("draws the three architecture diagrams with accessible names", () => {
    render(<SystemsDossier />);
    for (const name of [/h3 k-ring/i, /fencing token/i, /saga with transactional outbox/i]) {
      expect(screen.getByRole("img", { name })).toBeInTheDocument();
    }
  });

  it("lists every load-test iteration", () => {
    render(<SystemsDossier />);
    const table = screen.getByRole("table", { name: /load-test iterations/i });
    for (const r of LOAD_TEST_RUNS) expect(table).toHaveTextContent(r.run);
  });

  it("has no resume, interview or team wording", () => {
    render(<SystemsDossier />);
    expect(document.body.textContent).not.toMatch(/resume|interview|track [ab]|lead \d|tarun|vedant/i);
  });
});
