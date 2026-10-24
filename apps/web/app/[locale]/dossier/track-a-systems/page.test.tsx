import { render, screen } from "@testing-library/react";
import SystemsDossier from "./page";
import { LOAD_TEST_RUNS, RESUME_BULLETS } from "@/lib/evidence";

describe("Systems dossier", () => {
  it("draws the three architecture diagrams with accessible names", () => {
    render(<SystemsDossier />);
    for (const name of [/h3 k-ring/i, /fencing token/i, /saga with transactional outbox/i]) {
      expect(screen.getByRole("img", { name })).toBeInTheDocument();
    }
  });

  it("lists every load-test iteration and the resume bullets verbatim", () => {
    render(<SystemsDossier />);
    const table = screen.getByRole("table", { name: /load-test iterations/i });
    for (const r of LOAD_TEST_RUNS) expect(table).toHaveTextContent(r.run);
    for (const b of RESUME_BULLETS.systems) expect(screen.getByText(b)).toBeInTheDocument();
  });

  it("never mentions the team work split", () => {
    render(<SystemsDossier />);
    expect(document.body.textContent).not.toMatch(/track [ab]|lead \d|tarun|vedant/i);
  });
});
