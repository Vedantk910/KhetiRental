import { render, screen, within } from "@testing-library/react";
import Home from "./page";
import { EVIDENCE } from "@/lib/evidence";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("Home", () => {
  it("states each headline figure with its source", () => {
    render(<Home />);
    const ledger = screen.getByRole("table", { name: /evidence/i });
    for (const e of Object.values(EVIDENCE)) {
      const row = within(ledger).getByText(e.label).closest("tr")!;
      expect(row).toHaveTextContent(e.value);
      expect(row).toHaveTextContent(e.source);
    }
  });

  it("links to both track dossiers", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: /systems dossier/i })).toHaveAttribute("href", "/dossier/track-a-systems");
    expect(screen.getByRole("link", { name: /product dossier/i })).toHaveAttribute("href", "/dossier/track-b-product");
  });
});
