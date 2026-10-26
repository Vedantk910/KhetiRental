import { screen, within } from "@testing-library/react";
import { renderIntl } from "@/lib/test-intl";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { SkipLink } from "./skip-link";
import { TabBar } from "./tab-bar";

let pathname = "/";
let roles: ("renter" | "owner" | "admin")[] | null = null;
vi.mock("./use-roles", () => ({ useRoles: () => roles }));
vi.mock("@/i18n/navigation", async () => {
  const React = await import("react");
  return {
    usePathname: () => pathname,
    useRouter: () => ({ replace: vi.fn() }),
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href, ...rest }, children),
  };
});

describe("SkipLink", () => {
  it("jumps to #main in the current language", () => {
    renderIntl(<SkipLink />, { locale: "en" });
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main");
  });
});

describe("SiteHeader", () => {
  it("has the brand, a labelled main nav, the bell and the language switch", () => {
    pathname = "/rent/results";
    renderIntl(<SiteHeader />, { locale: "en" });
    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("link", { name: "KhetiRental" })).toHaveAttribute("href", "/");
    const nav = within(banner).getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Rent" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "My bookings" })).not.toHaveAttribute("aria-current");
    // Settings (where Log out lives) must be reachable from the menu, not only by typing its address.
    expect(within(nav).getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(within(banner).getByRole("link", { name: "Notifications" })).toHaveAttribute(
      "href",
      "/notifications",
    );
    expect(within(banner).getByRole("group", { name: "Language" })).toBeInTheDocument();
  });

  it("never mentions work-split wording", () => {
    renderIntl(<SiteHeader />);
    expect(document.body.textContent).not.toMatch(/track|lead \d|tarun|vedant/i);
  });
});

describe("TabBar", () => {
  it("shows Rent · My bookings · Help on app routes, active one marked", () => {
    pathname = "/bookings/KR-4821";
    renderIntl(<TabBar />, { locale: "hi" });
    const nav = screen.getByRole("navigation", { name: "Sections" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["किराया", "मेरी बुकिंग", "मदद", "सेटिंग्स"]);
    expect(links.map((l) => l.getAttribute("aria-current"))).toEqual([null, "page", null, null]);
  });

  it("owner-only accounts get Dashboard · My machines · Help", () => {
    pathname = "/owner";
    roles = ["owner"];
    renderIntl(<TabBar />, { locale: "en" });
    const links = within(screen.getByRole("navigation", { name: "Sections" })).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Dashboard", "My machines", "Help", "Settings"]);
    expect(links.map((l) => l.getAttribute("aria-current"))).toEqual(["page", null, null, null]);
    roles = null;
  });

  it("a renter who also owns gets an Owner tab", () => {
    pathname = "/rent";
    roles = ["renter", "owner"];
    renderIntl(<TabBar />, { locale: "en" });
    const links = within(screen.getByRole("navigation", { name: "Sections" })).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Rent", "My bookings", "Owner", "Help", "Settings"]);
    roles = null;
  });

  it("is absent on public pages", () => {
    pathname = "/help";
    renderIntl(<TabBar />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});

describe("SiteFooter", () => {
  it("has the six links and the language switch, no work-split wording", () => {
    pathname = "/";
    renderIntl(<SiteFooter />);
    const nav = screen.getByRole("navigation", { name: "Site links" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((l) => [l.textContent, l.getAttribute("href")]),
    ).toEqual([
      ["About", "/#story"],
      ["How we price", "/how-we-price"],
      ["How we built it", "/about/engineering"],
      ["Help", "/help"],
      ["Terms", "/terms"],
      ["Privacy", "/privacy"],
    ]);
    expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo").textContent).not.toMatch(/track|lead \d|tarun|vedant/i);
  });

  it("is hidden deep inside app routes", () => {
    pathname = "/bookings";
    renderIntl(<SiteFooter />);
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });
});
