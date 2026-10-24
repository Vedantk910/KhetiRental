import { render, screen } from "@testing-library/react";
import TrackA from "./page";
import { LOAD_TEST_RUNS, RESUME_BULLETS } from "@/lib/evidence";

describe("Track A dossier", () => {
  it("draws the three architecture diagrams with accessible names", () => {
    render(<TrackA />);
    for (const name of [/h3 k-ring/i, /fencing token/i, /saga with transactional outbox/i]) {
      expect(screen.getByRole("img", { name })).toBeInTheDocument();
    }
  });

  it("lists every load-test iteration and the resume bullets verbatim", () => {
    render(<TrackA />);
    const table = screen.getByRole("table", { name: /load-test iterations/i });
    for (const r of LOAD_TEST_RUNS) expect(table).toHaveTextContent(r.run);
    for (const b of RESUME_BULLETS.trackA) expect(screen.getByText(b)).toBeInTheDocument();
  });
});
