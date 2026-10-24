import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderIntl } from "@/lib/test-intl";
import { Sheet } from "./sheet";

function Harness({ busy = false }: { busy?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Open
      </button>
      <button type="button">Outside</button>
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Cancel this booking?"
        busy={busy}
      >
        <button type="button">Yes, cancel</button>
        <button type="button">Keep booking</button>
      </Sheet>
    </>
  );
}

describe("Sheet", () => {
  it("opens as a labelled modal dialog and moves focus inside", async () => {
    renderIntl(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const d = screen.getByRole("dialog", { name: "Cancel this booking?" });
    expect(d).toHaveAttribute("aria-modal", "true");
    expect(d).toContainElement(document.activeElement as HTMLElement);
    expect(document.querySelector("[data-sheet-open]")).not.toBeNull();
  });

  it("traps Tab and Shift+Tab inside", async () => {
    renderIntl(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const d = screen.getByRole("dialog");
    for (let i = 0; i < 7; i++) {
      await userEvent.tab();
      expect(d).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 7; i++) {
      await userEvent.tab({ shift: true });
      expect(d).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("Escape closes and returns focus to the opener", async () => {
    renderIntl(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    await userEvent.click(opener);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("the ✕ button closes and is 'Close' in the current language", async () => {
    renderIntl(<Harness />, { locale: "mr" });
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("button", { name: "बंद करा" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clicking the overlay closes", async () => {
    renderIntl(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(document.querySelector("[data-overlay]")!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("while busy, Escape, ✕ and the overlay do nothing, and focus stays inside", async () => {
    renderIntl(<Harness busy />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const close = screen.getByRole("button", { name: "Close" });
    expect(close).toHaveAttribute("aria-disabled", "true");
    close.focus();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(close);
    await userEvent.click(document.querySelector("[data-overlay]")!);
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
  });
});
