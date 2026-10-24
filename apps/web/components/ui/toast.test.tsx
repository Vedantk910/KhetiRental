import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderIntl } from "@/lib/test-intl";
import { ToastProvider, useToast } from "./toast";

function Fire() {
  const toast = useToast();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          toast({ tone: "success", message: "Payment successful (demo)" });
        }}
      >
        ok
      </button>
      <button
        type="button"
        onClick={() => {
          toast({ tone: "error", message: "We couldn't load this." });
        }}
      >
        err
      </button>
    </>
  );
}
const setup = () =>
  renderIntl(
    <ToastProvider>
      <Fire />
    </ToastProvider>,
  );

describe("Toast", () => {
  it("success goes in the status region and auto-dismisses after 5 s", async () => {
    vi.useFakeTimers();
    setup();
    await act(async () => {
      screen.getByRole("button", { name: "ok" }).click();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Payment successful (demo)");
    await act(async () => {
      vi.advanceTimersByTime(4900);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Payment successful");
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole("status")).not.toHaveTextContent("Payment successful");
    vi.useRealTimers();
  });

  it("errors go in the alert region and stay until dismissed", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "err" }));
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load this.");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });

  it("the two live regions exist before any toast (so screen readers announce)", () => {
    setup();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("useToast outside the provider throws a clear error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderIntl(<Fire />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
