import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderIntl } from "@/lib/test-intl";
import { LanguageSwitch } from "./language-switch";

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/rent/results",
  useRouter: () => ({ replace }),
}));

describe("LanguageSwitch", () => {
  beforeEach(() => {
    replace.mockReset();
    document.cookie = "NEXT_LOCALE=; max-age=0; path=/";
    window.history.replaceState(null, "", "/mr/rent/results?job=plough&acres=2");
  });

  it("is a labelled group of three toggle buttons, current one pressed", () => {
    renderIntl(<LanguageSwitch name="t" />, { locale: "mr" });
    expect(screen.getByRole("group", { name: "भाषा" })).toBeInTheDocument();
    const b = screen.getAllByRole("button");
    expect(b.map((x) => x.textContent)).toEqual(["मराठीम", "हिंदीहि", "EnglishEN"]);
    expect(b.map((x) => x.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
    expect(b.map((x) => x.getAttribute("lang"))).toEqual(["mr", "hi", "en"]);
  });

  it("switching keeps the path and query, sets the cookie", async () => {
    renderIntl(<LanguageSwitch name="t" />, { locale: "mr" });
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    expect(replace).toHaveBeenCalledWith("/rent/results?job=plough&acres=2", { locale: "en", scroll: false });
    expect(document.cookie).toContain("NEXT_LOCALE=en");
  });

  it("pressing the current language does nothing", async () => {
    renderIntl(<LanguageSwitch name="t" />, { locale: "mr" });
    await userEvent.click(screen.getByRole("button", { name: "मराठी" }));
    expect(replace).not.toHaveBeenCalled();
  });

  it("short labels are visual only; the accessible name stays the full name", () => {
    renderIntl(<LanguageSwitch name="t" tight />, { locale: "en" });
    expect(screen.getByRole("button", { name: "हिंदी" })).toBeInTheDocument();
  });

  it("after a keyboard switch, focus comes back to the pressed button of the same switch", () => {
    sessionStorage.setItem("kr:lang-focus", "t");
    renderIntl(<LanguageSwitch name="t" />, { locale: "hi" });
    expect(screen.getByRole("button", { name: "हिंदी" })).toHaveFocus();
    expect(sessionStorage.getItem("kr:lang-focus")).toBeNull();
  });

  it("remembers focus only when the switch itself had focus", async () => {
    renderIntl(<LanguageSwitch name="t" />, { locale: "mr" });
    screen.getByRole("button", { name: "English" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(sessionStorage.getItem("kr:lang-focus")).toBe("t");
  });
});

describe("LanguageSwitch: fast switching", () => {
  it("going back to the language still showing is honoured while the first switch is pending", async () => {
    replace.mockReset();
    renderIntl(<LanguageSwitch name="t" />, { locale: "mr" });
    await userEvent.click(screen.getByRole("button", { name: "हिंदी" }));
    await userEvent.click(screen.getByRole("button", { name: "मराठी" }));
    expect(replace.mock.calls.map((c) => (c[1] as { locale: string }).locale)).toEqual(["hi", "mr"]);
  });
});
