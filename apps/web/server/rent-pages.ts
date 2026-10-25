// Loading helpers shared by the renter pages (detail, booking). Not routes, so they live outside app/.
import { notFound } from "next/navigation";
import { apiParams, type Filters } from "@/lib/rent";
import { ApiError, uuidParam } from "./http";
import { machineDetail, resolvePlace } from "./machines";
import { pageUser } from "./page-user";
import { searchSchema } from "./validation";

/** Where the renter's farm is, for "3.5 km" on the owner row; unknown places simply show no distance. */
async function farmOrigin(f: Filters) {
  if (f.lat !== null && f.lng !== null) return { lat: f.lat, lng: f.lng };
  if (!f.place) return undefined;
  try {
    const p = await resolvePlace(searchSchema.parse(Object.fromEntries(apiParams(f))));
    return { lat: p.lat, lng: p.lng };
  } catch {
    return undefined;
  }
}

/** The machine, or null when it is paused, deleted or the id is junk. */
export async function loadMachine(id: string, f: Filters) {
  const user = await pageUser();
  if (!user) notFound();
  try {
    return await machineDetail(user, uuidParam(id), await farmOrigin(f));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}
