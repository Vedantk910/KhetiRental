import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Navbar } from "./navbar";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const LINKS: [string, string][] = [
  ["Marketplace Demo", "/marketplace"],
  ["H3 Spatial Sandbox", "/architecture/h3-spatial"],
  ["Pricing Engine", "/pricing"],
  ["3-Stage Escrow", "/escrow"],
  ["Architecture & ADRs", "/architecture"],
  ["Track B: Vedant (Product)", "/dossier/track-b-product"],
  ["Track A: Tarun (Systems)", "/dossier/track-a-systems"],
];

describe("Navbar", () => {
  beforeEach(() => {
    pathname = "/";
  });

  it("renders all 7 links with correct hrefs", () => {
    render(<Navbar />);
    for (const [name, href] of LINKS) {
      const matches = screen.getAllByRole("link", { name }).filter((a) => a.getAttribute("href") === href);
      expect(matches.length, name).toBeGreaterThan(0);
    }
  });

  it("shows an honest Demo mode status pill", () => {
    render(<Navbar />);
    expect(screen.getByText("Demo mode")).toBeInTheDocument();
    expect(screen.queryByText(/live/i)).toBeNull();
  });

  it("toggles the mobile menu via aria-expanded", async () => {
    render(<Navbar />);
    const btn = screen.getByRole("button", { name: /menu/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the menu on Escape", async () => {
    render(<Navbar />);
    const btn = screen.getByRole("button", { name: /menu/i });
    await userEvent.click(btn);
    await userEvent.keyboard("{Escape}");
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("marks the active link with aria-current=page", () => {
    pathname = "/pricing";
    render(<Navbar />);
    const current = screen.getAllByRole("link", { name: "Pricing Engine" });
    expect(current.every((a) => a.getAttribute("aria-current") === "page")).toBe(true);
    expect(screen.getAllByRole("link", { name: "3-Stage Escrow" })[0]).not.toHaveAttribute("aria-current");
  });
});
