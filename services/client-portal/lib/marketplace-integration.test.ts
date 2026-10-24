// Integration across tracks: the marketplace prices and books exactly the
// machines the matching API returns (no stubs).
import { GET } from "@/app/api/machines/near/route";
import { createBooking, resetStore } from "./marketplace-bookings";
import { fleetMachine } from "./marketplace-fleet";
import { nearUrl, parseNear, VILLAGES } from "./marketplace-places";
import { quoteRental } from "./marketplace-quote";

beforeEach(resetStore);

describe("marketplace over the real /api/machines/near", () => {
  it.each(VILLAGES.map((v) => [v.name, v] as const))("%s finds machines that can all be priced and booked", async (_, v) => {
    const res = await GET(new Request(`http://localhost${nearUrl(v)}`));
    expect(res.status).toBe(200);
    const found = parseNear(await res.json());
    expect(found.length).toBeGreaterThan(0);
    for (const c of found) {
      const m = fleetMachine(c.id);
      expect(m, `${c.id} returned by the API but unknown to the marketplace`).toBeDefined();
      expect(quoteRental(m!, "Sowing", 4).totalPaise).toBeGreaterThan(0);
      expect(m!.hp).toBe(String(c.hp === 75 ? "75_4wd" : c.hp));
    }
    const first = found[0];
    const booked = createBooking(crypto.randomUUID(), { machine_id: first.id, renter_id: "r-int", hours: 4 });
    expect(booked.status).toBe(202);
  });
});
