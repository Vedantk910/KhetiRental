"""KhetiRental marketplace KPIs & governance.


Three headline KPIs are defined with their *exact* formulas so both leads
share one source of truth, and so a PM / quant reviewer can audit them:

  1. Liquidity Index (LI)   — marketplace two-sidedness
  2. Time-to-Fulfill (TTF)  — demand-side speed
  3. Equipment Utilization Rate (EUR) — supply-side asset productivity

Each is a pure function over observable inputs; the tracking mechanism is a
TimescaleDB continuous aggregate (schema in `showcase/contracts/`), recomputed on a
5-minute cadence and exposed via the analytics service.

Formulas
--------
Liquidity Index (per H3-7 district, daily):
    LI = ( min(listings_active, active_requests) / max(listings_active, active_requests) )
         * (1 / p95(search_wait_seconds))
    A balanced two-sided market has LI -> 1 and p95 wait -> 0.

Time-to-Fulfill (median, minutes):
    TTF = median( t_booking_confirmed - t_search_submitted )
    Tracked per booking in the orchestrator's outbox timestamps.

Equipment Utilization Rate (per machine, monthly):
    EUR = ( billed_hours / (active_days * 24h) ) * 100 %
    Where billed_hours come from the post-return ΔH audit (escrow P2 gate)
    and active_days are days the machine was listed & online.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DistrictSnapshot:
    """One H3-7 district's daily counts."""
    district_h3: str
    listings_active: int      # machines online & available
    active_requests: int      # unresolved search/booking intents
    p95_search_wait_s: float  # p95 seconds from search to match


@dataclass(frozen=True)
class BookingTiming:
    """Per-booking latency sample (seconds)."""
    booking_id: str
    t_search_submitted_s: int
    t_booking_confirmed_s: int


@dataclass(frozen=True)
class MachineUtilization:
    """Per-machine monthly utilization sample."""
    machine_id: str
    billed_hours: float
    active_days: int


def liquidity_index(snap: DistrictSnapshot) -> float:
    """Return LI in [0, 1] for a district. 0.0 if either side is empty.

    The (1/p95_wait) term is bounded so a district with zero wait time does
    not blow up to infinity; we cap p95_wait at 1 s for the reciprocal.
    """
    if snap.listings_active == 0 or snap.active_requests == 0:
        return 0.0
    balance = min(snap.listings_active, snap.active_requests) / max(
        snap.listings_active, snap.active_requests
    )
    wait = max(snap.p95_search_wait_s, 1.0)
    speed = 1.0 / wait
    return round(min(1.0, balance * speed), 4)


def time_to_fulfill_minutes(bookings: list[BookingTiming]) -> float:
    """Median TTF in minutes across bookings. 0.0 for empty input."""
    if not bookings:
        return 0.0
    durs = sorted(
        (b.t_booking_confirmed_s - b.t_search_submitted_s) / 60.0 for b in bookings
    )
    n = len(durs)
    mid = n // 2
    if n % 2 == 1:
        return round(durs[mid], 3)
    return round((durs[mid - 1] + durs[mid]) / 2.0, 3)


def utilization_rate_pct(machine: MachineUtilization) -> float:
    """EUR for one machine, 0..100.

    Denominator is the *available* hours over the active window (24 h/day),
    which overstates a purely agricultural asset that is not 24/7. The
    product view normalizes this by a day-part factor elsewhere;
    here we return the raw asset-busy rate.
    """
    if machine.active_days <= 0:
        return 0.0
    denom = machine.active_days * 24.0
    return round(min(100.0, machine.billed_hours / denom * 100.0), 3)


def fleet_eur(machines: list[MachineUtilization]) -> float:
    """Fleet-weighted EUR = sum(billed) / sum(active*24) * 100, capped 100."""
    if not machines:
        return 0.0
    total_billed = sum(m.billed_hours for m in machines)
    total_avail = sum(m.active_days * 24.0 for m in machines)
    if total_avail <= 0:
        return 0.0
    return round(min(100.0, total_billed / total_avail * 100.0), 3)


def _demo() -> dict:
    snaps = [
        DistrictSnapshot("8.2e15", listings_active=42, active_requests=38, p95_search_wait_s=3.1),
        DistrictSnapshot("8.2e16", listings_active=9,  active_requests=40, p95_search_wait_s=7.4),
    ]
    li = {s.district_h3: liquidity_index(s) for s in snaps}

    bookings = [
        BookingTiming(f"B-{i}", t_search_submitted_s=0, t_booking_confirmed_s=i * 420 + 90)
        for i in range(12)
    ]
    ttf = time_to_fulfill_minutes(bookings)

    machines = [
        MachineUtilization(f"M-{i:03d}", billed_hours=38.0 + i * 2, active_days=30)
        for i in range(6)
    ]
    eur = fleet_eur(machines)

    return {
        "liquidity_index_by_district": li,
        "time_to_fulfill_median_min": ttf,
        "fleet_utilization_pct": eur,
        "per_machine_eur_pct": [utilization_rate_pct(m) for m in machines],
    }


def main() -> int:
    out = Path(__file__).resolve().parent / "results"
    out.mkdir(parents=True, exist_ok=True)
    report = _demo()
    dest = out / "kpis_report.json"
    dest.write_text(json.dumps(report, indent=2))
    print(f"wrote {dest}")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
