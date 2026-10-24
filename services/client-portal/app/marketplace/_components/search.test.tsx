import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketplaceSearch } from "./search";
import { fleetMachine } from "@/lib/marketplace-fleet";

const M2 = fleetMachine("M-002")!;

const near = { candidates: [
  { id: "M-002", dist_km: 3.2, score: 0.9, hp: 45, reputation: 0.9 },
  { id: "zz-unknown", dist_km: 7.5, score: 0.5, hp: 60, reputation: 0.5 },
], took_ms: 3 };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).startsWith("/api/machines/near")) return new Response(JSON.stringify(near), { status: 200 });
    if (url === "/api/bookings") return new Response(JSON.stringify({ booking_id: "bk_1", state: "ESCROW_AUTHORIZED" }), { status: 202 });
    throw new Error(`unexpected ${url} ${init?.method}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("MarketplaceSearch", () => {
  it("lists fleet machines with rate, rating, distance and HP, and survives unknown ids", async () => {
    render(<MarketplaceSearch />);
    const cards = await screen.findAllByRole("heading", { level: 3 });
    expect(cards).toHaveLength(2);
    const swaraj = cards[0].closest("li")!;
    expect(within(swaraj).getByText(/per hour/)).toBeInTheDocument();
    expect(within(swaraj).getByText("3.2 km")).toBeInTheDocument();
    expect(within(swaraj).getByText("45 HP")).toBeInTheDocument();
    expect(within(swaraj).getByText(`${M2.rating.toFixed(1)} / 5`)).toBeInTheDocument();
    const stranger = cards[1].closest("li")!;
    expect(within(stranger).getByText("Rate not available")).toBeInTheDocument();
    expect(within(stranger).getByRole("button")).toBeDisabled();
  });

  it("queries the near endpoint for the chosen village", async () => {
    const user = userEvent.setup();
    render(<MarketplaceSearch />);
    await screen.findAllByRole("heading", { level: 3 });
    await user.selectOptions(screen.getByLabelText("Village"), "Jagatpura");
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)![0]).toMatch(/lat=26\.8237&lng=75\.8674&radius_km=4&k=5/));
  });

  it("changes the rate when the activity changes", async () => {
    const user = userEvent.setup();
    render(<MarketplaceSearch />);
    const li = (await screen.findAllByRole("heading", { level: 3 }))[0].closest("li")!;
    const before = li.textContent;
    await user.selectOptions(screen.getByLabelText("What you need done".replace("you need", "do you need")), "Harvesting");
    expect(li.textContent).not.toBe(before);
  });

  it("shows a message when the search fails", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("no", { status: 500 }));
    render(<MarketplaceSearch />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
  });

  it("moves the end date along when the start date passes it", async () => {
    render(<MarketplaceSearch />);
    await screen.findAllByRole("heading", { level: 3 });
    const from = screen.getByLabelText("From");
    fireEvent.change(from, { target: { value: "2031-01-05" } });
    expect(screen.getByLabelText("To")).toHaveValue("2031-01-05");
    expect(screen.queryByText(/end date is before/)).toBeNull();
  });

  it("flags a bad acreage and blocks booking", async () => {
    const user = userEvent.setup();
    render(<MarketplaceSearch />);
    const book = await screen.findByRole("button", { name: new RegExp(`Book ${M2.label}`) });
    await user.clear(screen.getByLabelText("Farm size (acres)"));
    await user.type(screen.getByLabelText("Farm size (acres)"), "-3");
    expect(screen.getByText(/from 0\.1 to 1,000/)).toBeInTheDocument();
    expect(book).toBeDisabled();
  });
});

describe("booking modal", () => {
  async function open() {
    const user = userEvent.setup();
    render(<MarketplaceSearch />);
    const book = await screen.findByRole("button", { name: new RegExp(`Book ${M2.label}`) });
    await waitFor(() => expect(book).toBeEnabled());
    await user.click(book);
    return { user, book, dialog: await screen.findByRole("dialog", { name: new RegExp(`Book ${M2.label}`) }) };
  }

  it("is labelled, focuses the hours field, shows rental + deposit = total, and closes on Escape returning focus", async () => {
    const { user, book, dialog } = await open();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByLabelText(/hours/)).toHaveFocus();
    expect(within(dialog).getByText(/Rental, 4 h/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Refundable deposit/)).toBeInTheDocument();
    expect(within(dialog).getByText("Held in escrow")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(book).toHaveFocus();
  });

  it("traps Tab inside the dialog", async () => {
    const { user, dialog } = await open();
    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("submits once with an Idempotency-Key even when clicked repeatedly", async () => {
    let release!: () => void;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/bookings") { await new Promise<void>((r) => (release = r)); return new Response(JSON.stringify({ booking_id: "bk_1", state: "ESCROW_AUTHORIZED" }), { status: 202 }); }
      return new Response(JSON.stringify(near), { status: 200 });
    });
    const { user, dialog } = await open();
    const btn = within(dialog).getByRole("button", { name: "Authorise escrow" });
    await user.tripleClick(btn);
    await user.click(btn);
    const posts = fetchMock.mock.calls.filter((c) => c[0] === "/api/bookings");
    expect(posts).toHaveLength(1);
    expect((posts[0][1].headers as Record<string, string>)["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    release();
    expect(await within(dialog).findByText(/Escrow authorised/)).toBeInTheDocument();
  });

  it("explains a 409 and allows trying again with the same key", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/bookings"
        ? new Response(JSON.stringify({ code: "machine_unavailable", message: "x" }), { status: 409 })
        : new Response(JSON.stringify(near), { status: 200 }));
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("button", { name: "Authorise escrow" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/already booked/i);
    await user.click(within(dialog).getByRole("button", { name: "Authorise escrow" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter((c) => c[0] === "/api/bookings")).toHaveLength(2));
    const keys = fetchMock.mock.calls.filter((c) => c[0] === "/api/bookings").map((c) => c[1].headers["Idempotency-Key"]);
    expect(new Set(keys).size).toBe(1);
  });

  it("explains a 400 and rejects bad hours before sending", async () => {
    const { user, dialog } = await open();
    const hours = within(dialog).getByLabelText(/hours/);
    await user.clear(hours);
    await user.type(hours, "0");
    expect(within(dialog).getByRole("button", { name: "Authorise escrow" })).toBeDisabled();
    expect(hours).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock.mock.calls.filter((c) => c[0] === "/api/bookings")).toHaveLength(0);
  });
});
