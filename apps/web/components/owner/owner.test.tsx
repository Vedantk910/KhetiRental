import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderIntl } from "@/lib/test-intl";
import { MonthGrid } from "./month-grid";
import { ReplyTimer } from "./reply";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => "/owner",
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

describe("MonthGrid", () => {
  it("names each day with its state, and ignores taps on past days", async () => {
    const onPick = vi.fn();
    renderIntl(
      <MonthGrid
        month="2031-11"
        onMonth={vi.fn()}
        state={(d) =>
          d === "2031-11-02" ? "past" : d === "2031-11-05" ? "blocked" : d === "2031-11-06" ? "busy" : "free"
        }
        onPick={onPick}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /^\w+,? 2 November.*past/ }));
    expect(onPick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^\w+,? 5 November.*blocked/ }));
    expect(onPick).toHaveBeenLastCalledWith("2031-11-05", "blocked");
    await userEvent.click(screen.getByRole("button", { name: /^\w+,? 6 November.*booked/ }));
    expect(onPick).toHaveBeenLastCalledWith("2031-11-06", "busy");
    await userEvent.click(screen.getByRole("button", { name: /^\w+,? 7 November.*free/ }));
    expect(onPick).toHaveBeenLastCalledWith("2031-11-07", "free");
  });
});

describe("ReplyTimer", () => {
  afterEach(() => {
    refresh.mockClear();
    vi.useRealTimers();
  });
  it("counts down in hours and minutes, and reloads the page once when time is up", () => {
    vi.useFakeTimers();
    renderIntl(<ReplyTimer replyBy={new Date(Date.now() + 100 * 60_000)} />);
    expect(screen.getByText("Reply in 1 h 40 m")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(60 * 60_000);
    });
    expect(screen.getByText("Reply in 40 m")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(41 * 60_000);
    });
    expect(screen.getByText("Time is up")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
