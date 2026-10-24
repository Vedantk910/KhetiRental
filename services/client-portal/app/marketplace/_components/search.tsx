"use client";

import { LocateFixed, MapPin, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fleetMachine, HP_LABEL, type FleetMachine } from "@/lib/marketplace-fleet";
import { nearUrl, parseNear, SEARCH_RADIUS_KM, VILLAGES, type NearCandidate, type Place } from "@/lib/marketplace-places";
import { ACTIVITIES, DIESEL_PRICE_INR, estimateHours, formatInr, HOURS_PER_ACRE, quoteRental, type Activity } from "@/lib/marketplace-quote";
import { BookingModal } from "./booking-modal";

type Load = { status: "loading" } | { status: "ok"; items: NearCandidate[] } | { status: "error"; message: string };
const field = "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-fg";
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

export function MarketplaceSearch() {
  const [activity, setActivity] = useState<Activity>("Sowing");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [acres, setAcres] = useState("5");
  const [place, setPlace] = useState<Place>(VILLAGES[0]);
  const [geoMsg, setGeoMsg] = useState("");
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [booking, setBooking] = useState<FleetMachine | null>(null);

  useEffect(() => {
    // Set on mount so server and client markup agree.
    const t = new Date();
    t.setDate(t.getDate() + 1);
    setFrom(iso(t));
    setTo(iso(t));
  }, []);

  useEffect(() => {
    const ctl = new AbortController();
    setLoad({ status: "loading" });
    fetch(nearUrl(place), { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setLoad({ status: "ok", items: parseNear(d) }))
      .catch((e) => {
        if (e?.name !== "AbortError") setLoad({ status: "error", message: "We could not load nearby tractors. Check your connection and try again." });
      });
    return () => ctl.abort(); // a newer filter change always wins
  }, [place]);

  const acresNum = Number(acres);
  const acresErr = !(acres.trim() && Number.isFinite(acresNum) && acresNum > 0 && acresNum <= 1000) ? "Enter farm size in acres, from 0.1 to 1,000." : "";
  const dateErr = from && to && to < from ? "The end date is before the start date." : "";
  const hours = useMemo(() => estimateHours(acresNum), [acresNum]);

  function useMyLocation() {
    if (!navigator.geolocation) return setGeoMsg("This browser cannot share your location. Pick a village instead.");
    setGeoMsg("Finding you...");
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeoMsg(""); setPlace({ name: "My location", lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => setGeoMsg("We could not get your location. Pick a village instead."),
      { timeout: 8000 },
    );
  }

  const canBook = !acresErr && !dateErr && !!from;

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <form className="space-y-4 self-start rounded-xl border border-line bg-surface p-5" onSubmit={(e) => e.preventDefault()} aria-label="Search filters">
        <label className="block text-sm font-medium">
          What do you need done
          <select className={field} value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
            {ACTIVITIES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <div className="grid gap-4">
          <label className="block text-sm font-medium">
            From
            <input type="date" className={field} value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} aria-invalid={!!dateErr} aria-describedby={dateErr ? "date-err" : undefined} />
          </label>
          <label className="block text-sm font-medium">
            To
            <input type="date" className={field} value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-invalid={!!dateErr} aria-describedby={dateErr ? "date-err" : undefined} />
          </label>
        </div>
        {dateErr && <p id="date-err" className="-mt-2 text-sm font-medium text-red-700 dark:text-red-400">{dateErr}</p>}
        <label className="block text-sm font-medium">
          Farm size (acres)
          <input inputMode="decimal" className={field} value={acres} onChange={(e) => setAcres(e.target.value)} aria-invalid={!!acresErr} aria-describedby="acres-help" />
        </label>
        <p id="acres-help" className={acresErr ? "-mt-2 text-sm font-medium text-red-700 dark:text-red-400" : "-mt-2 text-xs text-muted"}>
          {acresErr || `We assume about ${HOURS_PER_ACRE} hour per acre, so ${hours} h for your farm. That is our estimate, not a measurement.`}
        </p>
        <label className="block text-sm font-medium">
          Village
          <select
            className={field}
            value={VILLAGES.some((v) => v.name === place.name) ? place.name : ""}
            onChange={(e) => setPlace(VILLAGES.find((v) => v.name === e.target.value) ?? place)}
          >
            {!VILLAGES.some((v) => v.name === place.name) && <option value="">{place.name}</option>}
            {VILLAGES.map((v) => <option key={v.name}>{v.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={useMyLocation} className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-bg">
          <LocateFixed aria-hidden className="h-4 w-4" /> Use my location
        </button>
        <p role="status" className="text-xs text-muted">{geoMsg}</p>
      </form>

      <section aria-labelledby="results-h" aria-busy={load.status === "loading"}>
        <h2 id="results-h" className="text-lg font-bold">
          Tractors near {place.name} <span className="text-sm font-normal text-muted">within {SEARCH_RADIUS_KM} km</span>
        </h2>
        <div role="status" className="mt-1 text-sm text-muted">
          {load.status === "loading" && "Looking for tractors..."}
          {load.status === "ok" && `${load.items.length} found`}
        </div>
        {load.status === "error" && <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-400">{load.message}</p>}
        {load.status === "ok" && load.items.length === 0 && <p className="mt-3 text-muted">No tractors within {SEARCH_RADIUS_KM} km. Try another village.</p>}
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {load.status === "ok" && load.items.map((c) => (
            <ResultCard key={c.id} c={c} activity={activity} canBook={canBook} onBook={setBooking} />
          ))}
        </ul>
        <p className="mt-6 max-w-prose text-xs text-muted">
          Rates come from the pricing model at diesel ₹{DIESEL_PRICE_INR} a litre (an assumption) and include fuel. Owners and ratings are demo data.
        </p>
      </section>

      {booking && <BookingModal machine={booking} activity={activity} hours={hours} startDate={from} onClose={() => setBooking(null)} />}
    </div>
  );
}

function ResultCard({ c, activity, canBook, onBook }: { c: NearCandidate; activity: Activity; canBook: boolean; onBook: (m: FleetMachine) => void }) {
  const m = fleetMachine(c.id);
  const rate = m ? quoteRental(m, activity, 1).hourlyRateInr : null;
  const hp = m ? HP_LABEL[m.hp] : c.hp ? `${c.hp} HP` : "HP not listed";
  const rating = m ? m.rating.toFixed(1) : typeof c.reputation === "number" ? (c.reputation * 5).toFixed(1) : null;
  return (
    <li className="flex flex-col rounded-xl border border-line bg-surface p-4">
      <h3 className="font-semibold">{m ? m.label : `Tractor ${c.id}`}</h3>
      <p className="text-sm text-muted">{m ? `${m.owner}, ${m.village}` : "Owner details not available"}</p>
      <p className="mt-3 text-2xl font-bold tabular-nums">
        {rate !== null ? <>{formatInr(Math.round(rate * 100))}<span className="text-sm font-normal text-muted"> per hour</span></> : <span className="text-base font-medium text-muted">Rate not available</span>}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span>{hp}</span>
        <span className="inline-flex items-center gap-1"><MapPin aria-hidden className="h-3.5 w-3.5" />{c.dist_km.toFixed(1)} km</span>
        <span className="inline-flex items-center gap-1"><Star aria-hidden className="h-3.5 w-3.5" />{rating ? `${rating} / 5` : "No rating yet"}</span>
      </p>
      <button
        type="button" disabled={!m || !canBook} aria-label={`Book ${m ? m.label : c.id}`}
        onClick={() => m && onBook(m)}
        className="mt-4 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-fg disabled:opacity-50"
      >
        {m ? "Book" : "Not bookable in this demo"}
      </button>
    </li>
  );
}
