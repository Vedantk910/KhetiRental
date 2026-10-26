import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderIntl } from "@/lib/test-intl";
import { MonthGrid } from "./month-grid";
import { ReplyTimer } from "./reply";
import { RequestCard } from "./request-card";
import { RequestDetail } from "./request-detail";
import type { BookingView } from "@/components/rent/booking-detail";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => "/owner",
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

// The Accept / Decline buttons need the toast and router providers; they are not what these tests are about.
vi.mock("./reply", async (orig) => ({
  ...(await orig<typeof import("./reply")>()),
  ReplyButtons: () => null,
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

describe("request card and detail show the job and distance", () => {
  const b = {
    id: "b1",
    code: "KR-2001",
    status: "REQUESTED",
    startDate: "2031-11-02",
    endDate: "2031-11-04",
    slot: "full",
    qty: 2.5,
    unit: "acre",
    job: "rotavate",
    distanceKm: 4,
    totalPaise: 350_000,
    rentPaise: 300_000,
    replyBy: new Date(Date.now() + 3_600_000).toISOString(),
    renter: { name: "Sunil P.", phone: null },
    machine: { name: "Swaraj 744 FE", village: "Latur" },
  } as unknown as BookingView;

  it("card: name, size and distance on the first line, the job beside the dates", () => {
    renderIntl(<RequestCard b={b} />);
    expect(screen.getByText(/Sunil P\. · 2\.5 acres · 4 km/)).toBeInTheDocument();
    expect(screen.getByText(/Rotavate · Swaraj 744 FE/)).toBeInTheDocument();
  });

  it("card and detail leave the lines out when the booking has neither", () => {
    const plain = { ...b, job: null, distanceKm: null } as unknown as BookingView;
    renderIntl(<RequestCard b={plain} />);
    expect(screen.getByText(/Sunil P\. · 2\.5 acres$/)).toBeInTheDocument();
    renderIntl(<RequestDetail b={plain} />);
    expect(screen.queryByText(/Work wanted/)).toBeNull();
    expect(screen.queryByText(/From your machine/)).toBeNull();
  });

  it("detail: work wanted and distance; under a kilometre reads as such", () => {
    renderIntl(<RequestDetail b={b} />);
    expect(screen.getByText("Work wanted: Rotavate")).toBeInTheDocument();
    expect(screen.getByText("From your machine: 4 km")).toBeInTheDocument();
    renderIntl(<RequestDetail b={{ ...b, distanceKm: 0.5 }} />);
    expect(screen.getByText("From your machine: under 1 km")).toBeInTheDocument();
  });
});
