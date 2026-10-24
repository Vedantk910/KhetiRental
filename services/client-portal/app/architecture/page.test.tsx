import { render, screen } from "@testing-library/react";
import Architecture from "./page";

describe("Architecture & ADRs", () => {
  it("lists the services and links every ADR and the H3 sandbox", () => {
    render(<Architecture />);
    for (const s of ["matching-engine", "booking-orchestrator", "telemetry-gateway", "client-portal"]) {
      expect(screen.getByText(s)).toBeInTheDocument();
    }
    for (const id of ["ADR-0001", "ADR-0002", "ADR-0003", "ADR-0004"]) {
      expect(screen.getByText(new RegExp(id))).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: /h3 spatial sandbox/i })).toHaveAttribute("href", "/architecture/h3-spatial");
  });
});
